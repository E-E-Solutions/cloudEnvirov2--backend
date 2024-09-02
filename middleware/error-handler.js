const { StatusCodes } = require("http-status-codes");
const errorHandlerMiddleware = (err, req, res, next) => {
  console.log("error is in error-handler middleware : ", err);
  let customError = {
    // set default
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    message: err.message || "Something went wrong try again later",
  };

  // duplicate error handler ....
  if (err.code && err.code === "ER_DUP_ENTRY") {
    const duplicateEntry = err.sqlMessage.match(/'([^']+)'/) || "";
    const extractedValue = duplicateEntry ? duplicateEntry[1] : null;
    customError.message = `Duplicate value entered for ${extractedValue} field, please choose another value`;
    customError.statusCode = 404;
  }

  if (err.code && err.code === "ER_NO_SUCH_TABLE") {
    const match = err.sqlMessage.match(/Table 'pcb_app\.([^']+)'/) || "";
    const extractedValue = match ? match[1] : null;
    customError.message = `No device is found with id ${extractedValue} check the device id or industry code`;
    customError.statusCode = 404;
  }
  if (err.code === "ER_BAD_FIELD_ERROR") {
    const match = err.sqlMessage.match(/Unknown column '([^']+)'/) || [];
    const columnName = match[1] || null;
    customError.message = `parameter '${columnName}' is not present in this table`;
    customError.statusCode = 400;
  }

  return res
    .status(customError.statusCode)
    .json({ message: customError.message });
};

module.exports = errorHandlerMiddleware;
