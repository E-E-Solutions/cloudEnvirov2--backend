// corsMiddleware.js
const corsMiddleware = (req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://www.highdreamconsulting.com"
  ); // Replace with your allowed origin
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  ); // Add allowed HTTP methods
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Add allowed headers
  res.setHeader("Access-Control-Allow-Credentials", true); // Allow credentials (cookies, authorization headers, etc.)
  if (req.method === "OPTIONS") {
    // Handle preflight requests
    return res.status(200).end();
  }
  next();
};

module.exports = corsMiddleware;
