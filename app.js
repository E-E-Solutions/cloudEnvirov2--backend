// Import express-async-errors to handle async errors in Express routes
require("express-async-errors");

// Import the express module
const express = require("express");

// Import cors for handling Cross-Origin Resource Sharing
const cors = require("cors");

// Load environment variables from a .env file into process.env
require("dotenv").config();

// Create an Express application
const app = express();

// Define the port on which the server will listen
const port = 5000;

// Import body-parser to parse incoming request bodies
const bodyParser = require("body-parser");

// Import custom error handling middleware
const errorHandlerMiddleware = require("./middleware/error-handler");

// Import middleware to handle 404 (Not Found) errors
const notFoundMiddleware = require("./middleware/not-found");

// Import the user routes
const userRoute = require("./routes/AuthRoute");
const deviceRoute = require("./routes/DeviceRoute");
const dataRoute = require("./routes/DataRoute");
const { authenticateUser } = require("./middleware/authentication");

// Use cors middleware to enable CORS with various options
app.use(cors());

// Use express.json middleware to parse JSON payloads with a size limit of 2MB
app.use(express.json({ limit: "2mb" }));

// Use body-parser middleware to parse JSON payloads
app.use(bodyParser.json());

// Use body-parser middleware to parse URL-encoded payloads
app.use(bodyParser.urlencoded({ extended: false }));

// Serve static files from the "public" directory
app.use(express.static("./public"));

// testing ..
app.get("/testing", (req, res) => {
  res.status(200).json("success");
});

// Use the user routes for the specified path
app.use("/api/v1/user", userRoute);
app.use("/api/v1/device", authenticateUser, deviceRoute);
app.use("/api/v1/data", authenticateUser, dataRoute);

// Use custom error handling middleware
app.use(errorHandlerMiddleware);

// Use middleware to handle 404 (Not Found) errors
app.use(notFoundMiddleware);

// Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});
