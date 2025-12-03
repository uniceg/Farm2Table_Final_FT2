import { publishEvent } from "../queue/rabbit.js";

export const createProduct = async (req, res) => {
  try {
    const product = req.body;

    // Publish event to RabbitMQ
    await publishEvent("product.created", product);

    return res.json({
      message: "Product created & event published",
      product
    });
  } catch (error) {
    console.error("Error in createProduct:", error);
    return res.status(500).json({ error: "Failed to publish event" });
  }
};