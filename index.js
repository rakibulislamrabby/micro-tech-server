const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const { status } = require('express/lib/response');
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
        const paymentsCollection = client.db("micro_tech").collection("payments");
        const reviewsCollection = client.db("micro_tech").collection("reviews");
        const userProfileCollection = client.db("micro_tech").collection("profilesInfo");

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesteraAccount = await usersCollection.findOne({ email: requester });
            if (requesteraAccount.role === "admin") {
                next();
            }
            else {
                return res.status(403).send({ message: "Forbidden access" })
            }
        }
        app.post("/create-payment-intent", verifyJwt, async (req, res) => {
            const order = req.body;
            const price = order.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        });


        app.get("/user", verifyJwt, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        })


        app.get("/admin/:email", async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role == "admin";
            res.send({ admin: isAdmin })
        })

        //make admin api
        app.put("/user/admin/:email", verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: "admin" }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
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
        //make admin api
        // app.put("/user/profile/:email", verifyJwt, verifyAdmin, async (req, res) => {
        //     const email = req.params.email;
        //     const profile = req.body;
        //     console.log(profile);
        //     const filter = { email: email };
        //     const options = { upsert: true };
        //     const updateDoc = {
        //         $set: profile
        //     };
        //     const result = await usersCollection.updateOne(filter, updateDoc, options);
        //     res.send(result);
        // })
        app.post("/userProfiles", verifyJwt, async (req, res) => {
            try {
                const profile = req.body;
                console.log(profile);
                const result = await userProfileCollection.insertOne(profile);
                res.send(result);
            }
            catch (eee) {
                console.log(eee);
            }
        })
        app.get("/userProfiles/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await userProfileCollection.findOne(query);
            res.send(result)
        })

        //Display all products Api
        app.get("/product", async (req, res) => {
            const query = {};
            const cursor = ProductsCollection.find(query);
            const products = await cursor.toArray()
            res.send(products);
        });
        //manage product just admin can see this
        app.get("/manageproduct", verifyJwt, verifyAdmin, async (req, res) => {
            const products = await ProductsCollection.find().toArray();
            res.send(products);
        });
        //delete product
        app.delete("/manageproduct/:id", verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await ProductsCollection.deleteOne(filter);
            res.send(result);
        });


        app.get("/product/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await ProductsCollection.findOne(query);
            res.send(product);
        })
        app.post("/product", verifyJwt, verifyAdmin, async (req, res) => {
            const product = req.body;
            const result = await ProductsCollection.insertOne(product);
            res.send(result);
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
        app.get("/order/:id", verifyJwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await ordersCollection.findOne(query);
            res.send(order);
        })
        //cancel order
        app.delete("/order/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await ordersCollection.deleteOne(filter);
            res.send(result);
        })

        //order update after payment
        app.patch("/order/:id", async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentsCollection.insertOne(payment);
            const updatedorder = await ordersCollection.updateOne(filter, updatedDoc);
            res.send(updatedorder);
        })

        //manage all orders
        app.get("/allOrder", async (req, res) => {
            const products = await ordersCollection.find().toArray();
            res.send(products);
        })

        app.post("/order", async (req, res) => {
            const order = req.body;
            const query = {};
            const result = await ordersCollection.insertOne(order);
            res.send(result);
        })

        app.post("/reviews", verifyJwt, async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.send(result);
        })
        app.get("/reviews", async (req, res) => {
            const result = await reviewsCollection.find().toArray();
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
