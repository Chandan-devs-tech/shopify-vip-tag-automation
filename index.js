import dotenv from "dotenv";
import express from "express";
import crypto from "crypto";
import axios from "axios";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const shopifyStore = process.env.SHOPIFY_STORE;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
const VIP_SPEND_THRESHOLD =
  parseFloat(process.env.VIP_SPEND_THRESHOLD) || 11000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

const shopifyHeaders = {
  "Content-Type": "application/json",
  "X-Shopify-Access-Token": accessToken,
};

function verifyWebhook(req) {
  if (!WEBHOOK_SECRET) return true;

  const hmac = req.headers["x-shopify-hmac-sha256"];
  const body = req.rawBody;
  const calculatedHmac = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body, "utf8")
    .digest("base64");

  return hmac === calculatedHmac;
}

app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

async function getCustomerOrders(customerId) {
  try {
    const response = await axios.get(
      `https://${shopifyStore}/admin/api/2023-10/orders.json?customer_id=${customerId}&status=any`,
      { headers: shopifyHeaders }
    );

    return response.data.orders;
  } catch (error) {
    console.error(
      `Error fetching orders for customer ${customerId}:`,
      error.response?.data || error.message
    );
    throw error;
  }
}

async function calculateLifetimeSpend(customerId) {
  try {
    const orders = await getCustomerOrders(customerId);

    const lifetimeSpend = orders.reduce((total, order) => {
      if (
        order.financial_status === "paid" ||
        order.financial_status === "partially_paid"
      ) {
        return total + parseFloat(order.total_price);
      }
      return total;
    }, 0);

    return lifetimeSpend;
  } catch (error) {
    console.error(
      `Error calculating lifetime spend for customer ${customerId}:`,
      error.message
    );
    throw error;
  }
}

async function updateCustomerTags(customerId, tags) {
  try {
    await axios.put(
      `https://${shopifyStore}/admin/api/2023-10/customers/${customerId}.json`,
      {
        customer: {
          id: customerId,
          tags: tags,
        },
      },
      { headers: shopifyHeaders }
    );

    console.log(`Updated tags for customer ${customerId}: ${tags}`);
  } catch (error) {
    console.error(
      `Error updating tags for customer ${customerId}:`,
      error.response?.data || error.message
    );
    throw error;
  }
}

async function addCustomerNote(customerId, note) {
  try {
    const customerResponse = await axios.get(
      `https://${shopifyStore}/admin/api/2023-10/customers/${customerId}.json`,
      { headers: shopifyHeaders }
    );

    const customer = customerResponse.data.customer;
    const currentNote = customer.note || "";
    const updatedNote = currentNote ? `${currentNote}\n${note}` : note;

    await axios.put(
      `https://${shopifyStore}/admin/api/2023-10/customers/${customerId}.json`,
      {
        customer: {
          id: customerId,
          note: updatedNote,
        },
      },
      { headers: shopifyHeaders }
    );

    console.log(`Added note to customer ${customerId}`);
  } catch (error) {
    console.error(
      `Error adding note to customer ${customerId}:`,
      error.response?.data || error.message
    );
    throw error;
  }
}

async function getCustomer(customerId) {
  try {
    const response = await axios.get(
      `https://${shopifyStore}/admin/api/2023-10/customers/${customerId}.json`,
      { headers: shopifyHeaders }
    );
    return response.data.customer;
  } catch (error) {
    console.error(
      `Error fetching customer ${customerId}:`,
      error.response?.data || error.message
    );
    throw error;
  }
}

async function processOrder(order) {
  if (
    !order.customer ||
    (order.financial_status !== "paid" &&
      order.financial_status !== "partially_paid")
  ) {
    return;
  }

  const customerId = order.customer.id;
  console.log(`Processing order ${order.id} for customer ${customerId}`);

  try {
    const customer = await getCustomer(customerId);
    const currentTags = customer.tags ? customer.tags.split(", ") : [];

    if (currentTags.includes("VIP-Customer")) {
      console.log(`Customer ${customerId} is already tagged as VIP`);
      return;
    }

    const lifetimeSpend = await calculateLifetimeSpend(customerId);
    console.log(
      `Customer ${customerId} lifetime spend: ₹${lifetimeSpend.toFixed(2)}`
    );

    if (lifetimeSpend >= VIP_SPEND_THRESHOLD) {
      currentTags.push("VIP-Customer");
      await updateCustomerTags(customerId, currentTags.join(", "));

      const timestamp = new Date().toISOString();
      const note = `Tagged as VIP-Customer on ${timestamp} (Lifetime spend: ₹${lifetimeSpend.toFixed(
        2
      )})`;
      await addCustomerNote(customerId, note);

      console.log(`✅ Added VIP tag to customer ${customerId}`);
    }
  } catch (error) {
    console.error(`Error processing order for VIP status: ${error.message}`);
  }
}

app.post("/webhooks/orders/paid", async (req, res) => {
  if (!verifyWebhook(req)) {
    console.error("Invalid webhook signature");
    return res.status(401).send("Invalid webhook signature");
  }

  res.status(200).send("OK");

  try {
    const order = req.body;
    await processOrder(order);
  } catch (error) {
    console.error("Error processing webhook:", error);
  }
});

app.post("/webhooks/orders/create", async (req, res) => {
  if (!verifyWebhook(req)) {
    console.error("Invalid webhook signature");
    return res.status(401).send("Invalid webhook signature");
  }

  res.status(200).send("OK");

  try {
    const order = req.body;

    if (
      order.financial_status === "paid" ||
      order.financial_status === "partially_paid"
    ) {
      await processOrder(order);
    } else {
      console.log(`Order ${order.id} is not paid yet, skipping VIP check`);
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
  }
});

app.get("/", (req, res) => {
  res.send({
    status: "active",
    service: "Shopify VIP Tag Automation (Webhook Version)",
    threshold: `₹${VIP_SPEND_THRESHOLD}`,
  });
});

app.listen(PORT, () => {
  console.log(`VIP Tag Webhook Service running on port ${PORT}`);
  console.log(`VIP threshold: ₹${VIP_SPEND_THRESHOLD}`);
});
