const { ValidationError } = require("joi");
const AppError = require("../utils/AppError.js");

const logError = (err) => {
  console.error("Error Details:", {
    name: err.name,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });
};

const handleJoiValidationError = (err) => ({
  status: "fail",
  statusCode: 400,
  message: "Validation Error",
  isOperational: true,
  details: err.details.map((detail) => ({
    field: detail.context.key,
    message: detail.message,
  })),
});

const sendErrorDev = (err, res) => {
  logError(err);
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      ...(err.errorCode && { errorCode: err.errorCode }),
      ...(err.details && { details: err.details }),
    });
  } else {
    logError(err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = { ...err };
  error.message = err.message;

  if (err instanceof ValidationError) {
    error = handleJoiValidationError(err);
  }

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  catchAsync,
  AppError,
};
