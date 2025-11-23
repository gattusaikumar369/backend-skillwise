const express = require("express");
const cors = require("cors");
const productsRouter = require("./routes/products");

const app = express();
app.use(cors());
app.use(express.json());

// THIS MUST RECEIVE A FUNCTION/ROUTER
app.use("/api/products", productsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
