import dotenv from "dotenv";
import axios from "axios";
import cron from "node-cron";

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
    const customers = [];
    let url = `https://${shopifyStore}/admin/api/2023-10/customers.json?limit=250`;

    while (url) {
      const response = await axios.get(url, { headers: shopifyHeaders });

      const pageCustomers = response.data.customers;
      customers.push(...pageCustomers);

      const linkHeader = response.headers.link || response.headers.Link;
      if (linkHeader && linkHeader.includes('rel="next"')) {
        url = linkHeader.split("<")[1].split(">")[0];
      } else {
        url = null;
      }
    }

    console.log(`Found ${customers.length} customers in total`);
    return customers;
  } catch (error) {
    console.error(
      "Error fetching customers:",
      error.response?.data || error.message
    );
    throw error;
  }
}

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

async function tagVIPCustomers() {
  try {
    console.log("Starting VIP customer tagging process...");
    console.log(`VIP threshold: ₹${VIP_SPEND_THRESHOLD}`);

    const customers = await getAllCustomers();
    let vipCount = 0;
    let newVipCount = 0;

    for (const customer of customers) {
      const lifetimeSpend = await calculateLifetimeSpend(customer.id);
      console.log(
        `Customer ${customer.id} (${
          customer.email
        }): Lifetime spend ₹${lifetimeSpend.toFixed(2)}`
      );

      if (lifetimeSpend >= VIP_SPEND_THRESHOLD) {
        vipCount++;

        const currentTags = customer.tags ? customer.tags.split(", ") : [];

        if (!currentTags.includes("VIP-Customer")) {
          newVipCount++;

          currentTags.push("VIP-Customer");
          await updateCustomerTags(customer.id, currentTags.join(", "));

          const timestamp = new Date().toISOString();
          const note = `Tagged as VIP-Customer on ${timestamp} (Lifetime spend: ₹${lifetimeSpend.toFixed(
            2
          )})`;
          await addCustomerNote(customer.id, note);

          console.log(
            `✅ Added VIP tag to customer ${customer.id} (${customer.email})`
          );
        } else {
          console.log(
            `⏩ Customer ${customer.id} (${customer.email}) is already tagged as VIP`
          );
        }
      }
    }

    console.log(
      `VIP tagging process completed: ${vipCount} total VIP customers, ${newVipCount} newly tagged`
    );
  } catch (error) {
    console.error("Error in VIP tagging process:", error);
  }
}

cron.schedule("0 0 * * *", () => {
  console.log("Running scheduled VIP tagging task...");
  tagVIPCustomers();
});

console.log("VIP Tag Automation service started");
tagVIPCustomers();
