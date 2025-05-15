# Shopify VIP Tag Automation

A scheduled job that automatically tags high-value Shopify customers as "VIP-Customer" when their lifetime spend exceeds ₹11,000.

## Features

- Automatically checks customer lifetime spend
- Tags customers as "VIP-Customer" when they exceed the spend threshold
- Records tag timestamp in customer notes
- Runs as a scheduled job (daily by default)

## APIs Used

- Shopify Admin API
  - Customers API to fetch and update customer data
  - Orders API to calculate lifetime spend

## Setup Instructions

1. Clone this repository

   ```bash
   git clone https://github.com/Chandan-devs-tech/shopify-vip-tag-automation.git
   cd shopify-vip-tag-automation
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Create a `.env` file with your Shopify API credentials

   ```bash
   SHOPIFY_STORE=your-store.myshopify.com
   SHOPIFY_ACCESS_TOKEN=your_access_token
   VIP_SPEND_THRESHOLD=11000
   ```

4. Start the application

   ```bash
   npm start
   ```

## How It Works

1. The application runs on a schedule (daily at midnight by default)
2. It fetches all customers from your Shopify store
3. For each customer, it calculates their lifetime spend by summing up all their orders
4. If a customer's lifetime spend exceeds the threshold (₹11,000 by default):
   - The customer is tagged as "VIP-Customer"
   - A timestamp is added to the customer's notes
5. Customers who are already tagged are skipped

## Testing

You can test the functionality with:

```bash
npm test
```

This will:

1. Connect to your Shopify store
2. Find a test customer
3. Test adding/removing the VIP tag
4. Verify that the functionality works correctly

## Customization

- The VIP threshold can be adjusted by changing the `VIP_SPEND_THRESHOLD` value in the `.env` file
- The schedule can be modified by changing the cron pattern in `index.js`

## Assumptions

- Customers must have completed orders to count towards their lifetime spend
- Only paid or partially paid orders are considered in the calculation
- The VIP tag is "VIP-Customer" (as specified in the requirements)

## Limitations

- Runs as a scheduled job rather than in real-time
- For stores with many customers, processing may take some time

## Technology Used

- Node.js
- Shopify Admin API
- node-cron for scheduling
- axios for API requests
- dotenv for environment variable management
