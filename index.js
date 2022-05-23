const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const { status } = require('express/lib/response');
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rsekk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJwt(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "unAuthorized access" });

    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden Access" })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        console.log('connected');
        const ProductsCollection = client.db("micro_tech").collection("products");
        const ordersCollection = client.db("micro_tech").collection("Orders");
        const usersCollection = client.db("micro_tech").collection("users");

        app.get("/user", verifyJwt, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        })

        //make admin api
        app.put("/user/admin/:email", verifyJwt, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesteraAccount = await usersCollection.findOne({ email: requester });
            if (requesteraAccount.role === "admin") {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: "admin" }
                };
                const result = await usersCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                return res.status(403).send({ message: "Forbidden access" })
            }


        })
        app.put("/user/:email", async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send({ result, token });
        })
        app.get("/product", async (req, res) => {
            const query = {};
            const cursor = ProductsCollection.find(query);
            const products = await cursor.toArray()
            res.send(products);
        });

        app.get("/product/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await ProductsCollection.findOne(query);
            res.send(product);
        })

        app.get("/order", verifyJwt, async (req, res) => {
            const buyer = req.query.buyer;
            const decodedEmail = req.decoded.email;
            if (buyer === decodedEmail) {
                const query = { buyer: buyer };
                const orders = await ordersCollection.find(query).toArray();
                res.send(orders);
            }
            else {
                return res.status(403).send({ message: "Forbidden access" })
            }

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
