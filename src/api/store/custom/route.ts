import { MedusaRequest, MedusaResponse } from "@medusajs/medusa";
import { ProductStatus } from "@medusajs/medusa/dist/models/product";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { CustomerService, OrderService, ProductService } from "@medusajs/medusa";
import { Router } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

interface RegisterRequestBody {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

interface LoginRequestBody {
  email: string;
  password: string;
}

interface CreatePromoCodeRequestBody {
  code: string;
  discount_amount: number;
  product_id: string;
}

const router = Router();

// Middleware to verify JWT token
const verifyToken = (req: MedusaRequest, res: MedusaResponse, next: Function) => {
  const token = req.headers['authorization']?.split(' ')[1];
  console.log('Received token:', token);
  if (!token) {
    console.log('No token provided');
    return res.status(403).json({ message: "A token is required for authentication" });
  }

  try {
    console.log('Attempting to verify token with secret:', JWT_SECRET);
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token verified successfully. Decoded:', decoded);
    req.user = decoded;
  } catch (err) {
    console.error('Token verification failed:', err);
    return res.status(401).json({ message: "Invalid Token" });
  }
  return next();
};

router.post("/register", async (req: MedusaRequest, res: MedusaResponse) => {
  const customerService: CustomerService = req.scope.resolve("customerService");
  const { email, password, first_name, last_name } = req.body as RegisterRequestBody;

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const customer = await customerService.create({
      email,
      password_hash: hashedPassword,
      first_name,
      last_name,
    });

    res.status(201).json({ success: true, customer_id: customer.id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

router.post("/login", async (req: MedusaRequest, res: MedusaResponse) => {
  const customerService: CustomerService = req.scope.resolve("customerService");
  const { email, password } = req.body as LoginRequestBody;

  try {
    const customer = await customerService.retrieveByEmail(email, {
      select: ["id", "password_hash"],
    });

    if (!customer) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, customer.password_hash);

    if (!passwordMatch) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ customer_id: customer.id }, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
});

// Purchase history
router.get("/purchase-history", verifyToken, async (req: MedusaRequest, res: MedusaResponse) => {
  const orderService: OrderService = req.scope.resolve("orderService");
  const customerId = (req.user as any).customer_id;

  try {
    const orders = await orderService.list({ customer_id: customerId });
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
});

// Admin panel routes
interface CreateProductRequestBody {
  title: string;
  description: string;
  price: number;
}

router.post("/custom-admin/product", verifyToken, async (req: MedusaRequest, res: MedusaResponse) => {
  const productService: ProductService = req.scope.resolve("productService");
  const { title, description, price } = req.body as CreateProductRequestBody;

  try {
    if (!title || typeof title !== 'string') {
      throw new Error('Invalid or missing title');
    }
    const productData = {
      title,
      description: description || '',
      status: ProductStatus.DRAFT,
      is_giftcard: false,
      discountable: true,
      variants: [{
        title: title,
        prices: [{ amount: price || 0, currency_code: 'usd' }],
        inventory_quantity: 0,
        options: [{ value: 'Default' }]
      }],
    };
    const product = await productService.create(productData);
    if (!product || !product.id) {
      throw new Error('Failed to create product');
    }
    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: (error as Error).message || "An error occurred" });
  }
});

// Promo code feature
router.post("/promo-codes", verifyToken, async (req: MedusaRequest, res: MedusaResponse) => {
  console.log("Promo code route reached");
  console.log("Request body:", req.body);
  console.log("Request headers:", req.headers);

  const discountService: any = req.scope.resolve("discountService");
  console.log("Discount service resolved:", discountService);

  const { code, discount_amount, product_id } = req.body as CreatePromoCodeRequestBody;
  console.log("Extracted request data:", { code, discount_amount, product_id });

  try {
    console.log("Attempting to create discount");
    const discountData = {
      code,
      rule: {
        type: "percentage",
        value: discount_amount,
        allocation: "total",
      },
      is_dynamic: false,
      is_disabled: false,
      regions: ["reg_01"], // Assuming a default region, adjust as needed
      usage_limit: null,
      valid_duration: null,
      metadata: { product_id },
    };
    console.log("Discount data:", discountData);

    const discount = await discountService.create(discountData);
    console.log("Discount created successfully:", discount);
    res.status(201).json({ success: true, discount });
  } catch (error) {
    console.error('Error creating promo code:', error);
    console.error('Error stack:', (error as Error).stack);
    res.status(500).json({ success: false, message: (error as Error).message || "An error occurred" });
  }
});

router.get("/", (req: MedusaRequest, res: MedusaResponse) => {
  res.sendStatus(200);
});

export default router;
