const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const jwt = require('jsonwebtoken');
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rsekk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();
        console.log('connected');
        const ProductsCollection = client.db("micro_tech").collection("products");
        const ordersCollection = client.db("micro_tech").collection("Orders");
        const usersCollection = client.db("micro_tech").collection("users");

        app.put("/user/:email", async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })
        app.get("/product", async (req, res) => {
            const query = {};
            const cursor = ProductsCollection.find(query);
            const products = await cursor.toArray()
            res.send(products)
        });

        app.get("/product/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await ProductsCollection.findOne(query);
            res.send(product);
        })

        app.get("/order", async (req, res) => {
            const buyer = req.query.buyer;
            console.log("backend", buyer);
            const query = { buyer: buyer };
            const orders = await ordersCollection.find(query).toArray();
            res.send(orders)
        })

        app.post("/order", async (req, res) => {
            const order = req.body;
            const query = {};
            const result = await ordersCollection.insertOne(order);
            res.send(result);
        })
    }
    finally {

    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Service is running")
})
app.listen(port, () => {
    console.log('server is running');
})
