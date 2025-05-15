import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const shopifyStore = process.env.SHOPIFY_STORE;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
const VIP_SPEND_THRESHOLD =
  parseFloat(process.env.VIP_SPEND_THRESHOLD) || 11000;

const shopifyHeaders = {
  "Content-Type": "application/json",
  "X-Shopify-Access-Token": accessToken,
};

async function getAllCustomers() {
  try {
    const response = await axios.get(
      `https://${shopifyStore}/admin/api/2023-10/customers.json?limit=10`,
      { headers: shopifyHeaders }
    );

    return response.data.customers;
  } catch (error) {
    console.error(
      "Error fetching customers:",
      error.response?.data || error.message
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
    return true;
  } catch (error) {
    console.error(
      `Error updating tags for customer ${customerId}:`,
      error.response?.data || error.message
    );
    throw error;
  }
}

async function checkCustomerTags(customerId) {
  try {
    const response = await axios.get(
      `https://${shopifyStore}/admin/api/2023-10/customers/${customerId}.json`,
      { headers: shopifyHeaders }
    );

    const customer = response.data.customer;
    const tags = customer.tags ? customer.tags.split(", ") : [];

    console.log(`Customer ${customerId} tags: ${tags.join(", ") || "No tags"}`);
    return tags;
  } catch (error) {
    console.error(
      `Error checking tags for customer ${customerId}:`,
      error.response?.data || error.message
    );
    throw error;
  }
}

async function runTest() {
  try {
    console.log("=== STARTING VIP TAG FUNCTIONALITY TEST ===");
    console.log(`VIP threshold: ₹${VIP_SPEND_THRESHOLD}`);

    const customers = await getAllCustomers();
    console.log(`Found ${customers.length} customers in the store.`);

    if (customers.length === 0) {
      console.log(
        "No customers found. Please create test customers manually in your Shopify admin."
      );
      return;
    }

    const testCustomer =
      customers.find((c) => c.email && c.email.includes("rahul.sharma")) ||
      customers[0];
    console.log(
      `Using customer: ${testCustomer.first_name} ${testCustomer.last_name} (${testCustomer.email})`
    );

    const currentTags = testCustomer.tags ? testCustomer.tags.split(", ") : [];
    const hasVipTag = currentTags.includes("VIP-Customer");

    if (hasVipTag) {
      const newTags = currentTags
        .filter((tag) => tag !== "VIP-Customer")
        .join(", ");
      await updateCustomerTags(testCustomer.id, newTags);
      console.log("Removed VIP tag for testing purposes.");
    }

    const tagsToAdd = currentTags.includes("VIP-Customer")
      ? currentTags.join(", ")
      : [...currentTags, "VIP-Customer"].join(", ");

    await updateCustomerTags(testCustomer.id, tagsToAdd);

    const updatedCustomer = await axios.get(
      `https://${shopifyStore}/admin/api/2023-10/customers/${testCustomer.id}.json`,
      { headers: shopifyHeaders }
    );

    const finalTags = updatedCustomer.data.customer.tags.split(", ");
    const success = finalTags.includes("VIP-Customer");

    console.log(`VIP tag added successfully: ${success ? "YES" : "NO"}`);
    console.log(
      `Final customer tags: ${updatedCustomer.data.customer.tags || "None"}`
    );

    console.log("=== TEST COMPLETED ===");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTest();
