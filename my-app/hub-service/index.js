import express from "express";
import cors from "cors";
import productRoutes from "./routes/productRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js"; // ADD THIS LINE
import { connectRabbit } from "./queue/rabbit.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/products", productRoutes);
app.use("/payments", paymentRoutes); // ADD THIS LINE

// Basic health check
app.get("/", (req, res) => {
  res.json({
    service: "Hub Service",
    status: "running",
    version: "1.0",
    endpoints: {
      products: "/products",
      payments: "/payments"
    }
  });
});

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    rabbitmq: "connected"
  });
});

// Connect to RabbitMQ when server starts
connectRabbit().then(() => {
  console.log("✅ RabbitMQ connection initialized");
});

app.listen(4001, () => {
  console.log("🚀 Hub Service running on http://localhost:4001");
});