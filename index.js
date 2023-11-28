const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

// create app
const app = express();

// stripe related
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

// constants
const port = process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@porfolioprojects.vkb3mrm.mongodb.net/?retryWrites=true&w=majority`;

// middlewares
app.use(express.json());
app.use(cors());

// verify jwt middleware
const verifyJWt = (req, res, next) => {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return res
            .status(401)
            .send({ error: true, message: "unauthorized access" });
    }

    const token = authorization.split(" ")[1]; // ['bearer', token......]

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res
                .status(401)
                .send({ error: true, message: "unauthorized access" });
        }

        req.decoded = decoded;
        next();
    });
};

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

app.get("/", (req, res) => {
    res.send("Welcome to litl-pal server");
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // Connect to the "litl-pal" database and access its collections
        const database = client.db("litl-pal");
        const usersCollection = database.collection("users");
        const postsCollection = database.collection("posts");
        const preferencesCollection = database.collection("preferences");
        const paymentCollection = database.collection("payments");
        const wishlistsCollection = database.collection("wishlists");

        // get routes
        app.get("/api/adoptable-posts", async (req, res) => {
            /**
             * /api/adoptable-posts:
             *   Author:
             *     Mutaher Ahmed Shakil
             *   get:
             *     summary: Gives all the adoptable posts that are active.
             *     responses:
             *       200:
             *         description: Request successfully served.
             *       500:
             *         description: Internal server error.
             */
            try {
                const animalType = req?.query?.animaltype
                    ? { animalType: req?.query?.animaltype }
                    : {};
                const postStatus = req?.query?.postStatus;

                const query = {
                    $and: [
                        { postType: "adoption" },
                    ],
                };

                if (postStatus) {
                    query.$and.push({ postStatus: { $in: req?.query?.postStatus.split(",") } })
                }

                if (animalType) {
                    query.$and.push(animalType);
                }

                const options = { sort: { postDate: -1 } };


                const cursor = await postsCollection.find(query, options).toArray();
                console.log(query, cursor)

                res.status(200).send(cursor);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        app.get("/api/adoptable-posts/:id", async (req, res) => {
            /**
             * /api/adoptable-posts:
             *   Author:
             *     Margub Murshed
             *   get:
             *     summary: Gives specific  adoptable post that are active.
             *     responses:
             *       200:
             *         description: Request successfully served.
             *       500:
             *         description: Internal server error.
             */
            try {
                const id = req.params.id;
                const cursor = await postsCollection
                    .find({ _id: new ObjectId(id) })
                    .toArray();
                res.status(200).send(cursor);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        app.delete("/api/posts/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const result = await postsCollection.deleteOne({
                    _id: new ObjectId(id),
                });
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        app.get("/api/missing-posts", async (req, res) => {
            /**
             * /api/missing-posts:
             *   Author:
             *     Mutaher Ahmed Shakil
             *   get:
             *     summary: Gives all the adoptable posts that are active.
             *     responses:
             *       200:
             *         description: Request successfully served.
             *       500:
             *         description: Internal server error.
             */
            try {
                const animalType = req?.query?.animaltype
                    ? { animalType: req?.query?.animaltype }
                    : {};
                const postStatus = req?.query?.postStatus
                    ? { postStatus: req?.query?.postStatus }
                    : {};
                const query = { postType: "lost", ...animalType, ...postStatus };
                const options = { sort: { postDate: -1 } };

                const cursor = await postsCollection.find(query, options).toArray();

                res.status(200).send(cursor);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        app.get("/verifyAdmin", async (req, res) => {
            const email = req.headers.email;
            const user = await usersCollection.findOne({ email });
            if (!user)
                return res.status(401).send({ error: true, message: "User not found" });
            if (user.role === "admin") return res.send({ admin: true });
            else res.send({ admin: false });
        });

        app.get("/api/user-preference/:email", async (req, res) => {
            /**
             * /api/user-preference:
             *   Author:
             *     Mutaher Ahmed Shakil
             *   get:
             *     summary: Get the user preferences about selecting desired pet
             *     responses:
             *       200:
             *         description: Request successfully served.
             *       500:
             *         description: Internal server error.
             */
            try {
                const query = { email: req.params.email };
                const cursor = await preferencesCollection.findOne(query);

                res.status(200).send(cursor);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        //get wishlist api

        app.get("/api/user-wishlist", async (req, res) => {
            try {
                const cursor = await wishlistsCollection.find().toArray();
                res.status(200).send(cursor);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        //wishlist post api

        app.post("/api/user-wishlist", async (req, res) => {
            try {
                const result = await wishlistsCollection.insertOne(req.body);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        //wishlist single details

        app.get("/api/user-wishlist/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const cursor = await wishlistsCollection.findOne(query);
                res.status(200).send(cursor);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        app.get("/api/users", async (req, res) => {
            const email = req?.query?.email ? { email: req.query.email } : {};
            try {
                const result = await usersCollection.find({ ...email }).toArray();
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        //wishlist delete api

        app.delete("/api/user-wishlist/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await wishlistsCollection.deleteOne(query);
            res.send(result);
        });

        // post routes

        // post routes
        app.post("/api/jwt", (req, res) => {
            /**
             * /api/jwt:
             *   Author:
             *     Mutaher Ahmed Shakil
             *   post:
             *     - send the user email on the request body
             *     summary: Generates an access token when user logs in.
             *     responses:
             *       An object containing the token.
             */
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "12h",
            });
            res.send({ token });
        });

        app.post("/api/create-user", async (req, res) => {
            /**
             * /api/create-user:
             *   Author:
             *     Mutaher Ahmed Shakil
             *   post:
             *     summary: Creates a new user when user hits the register button.
             *     responses:
             *       200:
             *         description: Successfully created the user.
             *       500:
             *         description: Internal server error.
             */
            try {
                const newUser = {
                    name: req.body.name,
                    email: req.body.email,
                    photo: req.body.photo,
                    phone: req.body.phone,
                    address: req.body.address,
                    role: req.body.role,
                };

                const result = await usersCollection.insertOne(newUser);

                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        app.post("/api/create-post", async (req, res) => {
            /**
             * /api/create-post:
             *   Author:
             *     Mutaher Ahmed Shakil
             *   post:
             *     - send the post description on the request body (look trello board for details)
             *     summary: Creates a new post. It can be a missing post or adoption post.
             *     responses:
             *       200:
             *         description: Successfully created the user.
             *       500:
             *         description: Internal server error.
             */
            try {
                const result = await postsCollection.insertOne(req.body);
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        app.post("/api/user-preference", async (req, res) => {
            /**
             * /api/user-preference:
             *   Author:
             *     Mutaher Ahmed Shakil
             *   post:
             *     - send the quiz answers as user preference
             *     summary: Saves the user preference for suggesting the user specific pets.
             *     responses:
             *       200:
             *         description: Successfully saved / updated.
             *       500:
             *         description: Internal server error.
             */
            try {
                const filter = { email: req.body.email };
                const options = { upsert: true };
                const updateDoc = {
                    $set: {
                        ...req.body,
                    },
                };

                const result = await preferencesCollection.updateOne(
                    filter,
                    updateDoc,
                    options
                );
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        });

        /*-------------------------------------------
                    * APIs related to payment Website and User dashboard
                --------------------------------------------*/

        /*-------------------------------------------
                * when client intends to make a payment
                  but payment is not charged yet. 
            --------------------------------------------*/
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            console.log(price);
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post("/payments", async (req, res) => {
            // store payment info
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);
            res.send(insertResult);
        });



        app.get("/payment-history/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await paymentCollection
                .find(query)
                .sort({ date: -1 })
                .toArray();
            console.log("empty?", result);
            res.send(result);
        });

        /*-------------------------------------------
           * APIs related to Admin Dashboard
         --------------------------------------------*/
        // admin dashboard: fetching payment history
        app.get("/payments", async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result);
        });

        // Patch updates
        app.patch("/api/posts/:id", async (req, res) => {
            const id = req.params.id;
            const email = req?.body?.email;
            const postStatus = req.query.postStatus;

            // Define the update object based on request body parameters
            let updateObject = {};

            if (postStatus) {
                updateObject.postStatus = postStatus;
            }

            if (email) {
                const userData = await usersCollection.findOne({ email });
                const post = await postsCollection.findOne({ _id: new ObjectId(id) });
                const requestedBy = {
                    name: userData.name,
                    email: userData.email,
                    photo: userData.photo,
                };
                if (post.requestedBy) {
                    updateObject = {
                        $push: { requestedBy },
                    };
                } else {
                    updateObject = {
                        $set: { requestedBy: [requestedBy] },
                    };
                }
            }
            const result = await postsCollection.updateOne(
                { _id: new ObjectId(id) },
                updateObject,
                { returnOriginal: false }
            );
            res.send(result);
        });

        app.get("/posts/stats", async (req, res) => {
            const paymentData = await paymentCollection.find().toArray();

            // Weeks
            const startOfWeek = moment().startOf("week"); // Start of the current week
            const endOfWeek = moment().endOf("week"); // End of the current week

            const days = []; // Array to hold data for each day of the week

            // Loop through each day of the week
            for (let day = moment(startOfWeek); day <= endOfWeek; day.add(1, "day")) {
                const dayStart = day.startOf("day").valueOf();
                const dayEnd = day.endOf("day").valueOf();

                // Calculate counts for adoption and missing posts for the current day
                const adoptionCount = await postsCollection.countDocuments({
                    postType: "adoption",
                    postDate: { $gte: dayStart, $lte: dayEnd },
                });

                const missingCount = await postsCollection.countDocuments({
                    postType: "lost",
                    postDate: { $gte: dayStart, $lte: dayEnd },
                });

                const adoptionSuccessCount = await postsCollection.countDocuments({
                    postType: "adoption",
                    postStatus: 2,
                    postDate: { $gte: dayStart, $lte: dayEnd },
                });

                const missingSuccessCount = await postsCollection.countDocuments({
                    postType: "lost",
                    postStatus: 2,
                    postDate: { $gte: dayStart, $lte: dayEnd },
                });

                // Calculate total payment price for the current day
                let totalFunds = 0;
                paymentData.forEach((payment) => {
                    const paymentTime = new Date(payment.date).getTime();
                    if (paymentTime >= dayStart && paymentTime <= dayEnd) {
                        totalFunds += payment.price;
                    }
                });

                days.push({
                    dayOfWeek: day.format("ddd"), // Get the three-letter representation of the day (e.g., "Sun")
                    adoptionCount,
                    missingCount,
                    adoptionSuccessCount,
                    missingSuccessCount,
                    totalFunds,
                });
            }

            // Calculate total sum of prices for the current week from the payment collection
            const startOfWeekDate = moment().startOf("week").toDate().valueOf();
            const endOfWeekDate = moment().endOf("week").toDate().valueOf();

            let thisWeekTotalFunds = 0;

            paymentData.forEach((payment) => {
                const paymentTime = new Date(payment.date).getTime();
                if (paymentTime >= startOfWeekDate && paymentTime <= endOfWeekDate) {
                    thisWeekTotalFunds += payment.price;
                }
            });

            // monthly stats

            const startOfYear = moment().startOf("year"); // Start of the current year
            const endOfYear = moment().endOf("year"); // End of the current year

            const months = []; // Array to hold data for each month

            // Loop through each month of the year
            for (
                let month = moment(startOfYear);
                month <= endOfYear;
                month.add(1, "month")
            ) {
                const monthStart = month.startOf("month").toDate().valueOf();
                const monthEnd = month.endOf("month").toDate().valueOf();

                // Calculate counts for adoption and missing posts for the current month
                const adoptionCount = await postsCollection.countDocuments({
                    postType: "adoption",
                    postDate: { $gte: monthStart, $lte: monthEnd },
                });

                const missingCount = await postsCollection.countDocuments({
                    postType: "lost",
                    postDate: { $gte: monthStart, $lte: monthEnd },
                });

                const adoptionSuccessCount = await postsCollection.countDocuments({
                    postType: "adoption",
                    postStatus: 2,
                    postDate: { $gte: monthStart, $lte: monthEnd },
                });

                const missingSuccessCount = await postsCollection.countDocuments({
                    postType: "lost",
                    postStatus: 2,
                    postDate: { $gte: monthStart, $lte: monthEnd },
                });

                let totalFunds = 0;

                paymentData.forEach((payment) => {
                    const paymentTime = new Date(payment.date).getTime();
                    if (paymentTime >= monthStart && paymentTime <= monthEnd) {
                        totalFunds += payment.price;
                    }
                });

                const monthData = {
                    monthOfYear: month.format("MMM"), // Get the three-letter representation of the month (e.g., "Jan")
                    adoptionCount,
                    missingCount,
                    adoptionSuccessCount,
                    missingSuccessCount,
                    totalFunds,
                };

                months.push(monthData);
            }

            // Calculate total sum of prices for the current month
            const startOfMonth = moment().startOf("month").toDate().valueOf(); // Start of the current month
            const endOfMonth = moment().endOf("month").toDate().valueOf(); // End of the current month

            let thisMonthTotalFunds = 0;

            paymentData.forEach((payment) => {
                const paymentTime = new Date(payment.date).getTime();
                if (paymentTime >= startOfMonth && paymentTime <= endOfMonth) {
                    thisMonthTotalFunds += payment.price;
                }
            });

            const result = {
                weeklyStats: {
                    days,
                    totalFunds: thisWeekTotalFunds,
                },
                monthlyStats: {
                    months,
                    totalFunds: thisMonthTotalFunds,
                },
            };

            res.send(result);
        });

        app.get("/api/search", async (req, res) => {
            const { location, age, color, animalType, postType, gender } = req.query;

            const query = {};

            if (location) {
                // Create a regex pattern for location search
                query.location = { $regex: `^${location}$`, $options: "i" };
            }

            if (color) {
                // Case-insensitive search for exact color match
                query.color = { $regex: `^${color}$`, $options: "i" };
            }

            if (animalType) {
                query.animalType = animalType.toLowerCase(); // Ensure case-insensitive search
            }
            if (gender) {
                query.gender = gender.toLowerCase(); // Ensure case-insensitive search
            }
            if (postType) {
                query.postType = postType;
            }

            if (age !== undefined) {
                // Determine age criteria based on the value received
                if (age === "0") {
                    query.age = { $lt: 5 };
                } else if (age === "1") {
                    query.age = { $gte: 5 };
                }
            }

            console.log(
                `request query ${JSON.stringify(req.query)} & query ${JSON.stringify(
                    query
                )}`
            );

            try {
                const searchResult = await postsCollection.find(query).toArray();
                res.send(searchResult);
            } catch (error) {
                res.status(500).json({ error: "Internal server error" });
            }
        });



        /*-------------------------------------------
          * APIs related to User Dashboard
        --------------------------------------------*/

        //--------- Fetch adoption  posts ------------
        app.get("/user/manage-adoption-posts/:email", async (req, res) => {
            const email = req.params.email;
            console.log("email:", email);

            const query = {
                $and: [
                    { postUserEmail: email },
                    { postType: 'adoption' },
                    { postStatus: { $in: [0, 1] } }

                ]
            }


            console.log("query:", query);
            const result = await postsCollection
                .find(query)
                .sort({ date: -1 })
                .toArray();
            console.log("manage adoption:", result);
            res.send(result);
        });

        //--------- Fetch lost pet posts ------------
        app.get("/user/manage-missing-post/:email", async (req, res) => {
            const email = req.params.email;
            const query = {
                $and: [
                    { postUserEmail: email },
                    { postType: 'lost' },
                    { postStatus: { $in: [0, 1] } }

                ]
            }
            const result = await postsCollection
                .find(query)
                .sort({ date: -1 })
                .toArray();
            console.log("manage lost: ", result);
            res.send(result);
        });

        //--------- Fetch request adoption posts ------------
        app.get("/user/manage-adoption-request/:email", async (req, res) => {
            const email = req.params.email;
            const query = {
                $and: [
                    { postUserEmail: email },
                    { postType: 'adoption' },
                    { postStatus: "2" }  // todo: this field need to be number type, db field type needs to be edited. 

                ]
            };
            const result = await postsCollection
                .find(query)
                .sort({ date: -1 })
                .toArray();
            console.log("manage adoption request: ", result);
            res.send(result);
        });

        //--------- Fetch request missing posts ------------
        app.get("/user/manage-found-request/:email", async (req, res) => {
            const email = req.params.email;
            const query = {
                $and: [
                    { postUserEmail: email },
                    { postType: 'lost' },
                    { postStatus: "2" }  // todo: this field need to be number type, db field type needs to be edited. 

                ]
            };
            const result = await postsCollection
                .find(query)
                .sort({ date: -1 })
                .toArray();
            console.log("manage found request: ", result);
            res.send(result);
        });

        //--------- Fetch successful adoption posts ------------
        app.get("/user/manage-adoption-success/:email", async (req, res) => {
            const email = req.params.email;
            const query = {
                $and: [
                    { postUserEmail: email },
                    { postType: 'adoption' },
                    { postStatus: "3" }  // todo: this field need to be number type, db field type needs to be edited. 

                ]
            };
            const result = await postsCollection
                .find(query)
                .sort({ date: -1 })
                .toArray();
            console.log("manage adoption success: ", result);
            res.send(result);
        });


         //--------- Fetch successful found posts ------------
         app.get("/user/manage-found-success/:email", async (req, res) => {
            const email = req.params.email;
            const query = {
                $and: [
                    { postUserEmail: email },
                    { postType: 'lost' },
                    { postStatus: "3" }  // todo: this field need to be number type, db field type needs to be edited. 

                ]
            };
            const result = await postsCollection
                .find(query)
                .sort({ date: -1 })
                .toArray();
            console.log("manage found success: ", result);
            res.send(result);
        });


        //--------- Fetch archived adoption posts ------------
        app.get("/user/manage-archive-adoption/:email", async (req, res) => {
            const email = req.params.email;
            const query = {
                $and: [
                    { postUserEmail: email },
                    { postType: 'adoption' },
                    { postStatus: "4" }  // todo: this field need to be number type, db field type needs to be edited. 

                ]
            };
            const result = await postsCollection
                .find(query)
                .sort({ date: -1 })
                .toArray();
            console.log("manage adoption archive: ", result);
            res.send(result);
        });


        //--------- Fetch archived missing posts ------------
        app.get("/user/manage-archive-missing/:email", async (req, res) => {
            const email = req.params.email;
            const query = {
                $and: [
                    { postUserEmail: email },
                    { postType: 'lost' },
                    { postStatus: "4" }  // todo: this field need to be number type, db field type needs to be edited. 

                ]
            };
            const result = await postsCollection
                .find(query)
                .sort({ date: -1 })
                .toArray();
            console.log("manage missing archive: ", result);
            res.send(result);
        });




        // starting fresh







        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

// listen
app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
});
