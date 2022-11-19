const http = require("http");
const db = require("./db");
const queryString = require("query-string");

(async () => {
  const dbInstance = new db();
  const conn = await dbInstance.init();

  http
    .createServer(async function (req, res) {
      try {
        const headers = req.headers;
        const url = new URL("http://" + headers.host + req.url);
        const query = queryString.parse(url.search);

        console.log("➡️ :: Incoming request :: " + url.href);

        if (req.url == "/_list" && req.method.toUpperCase() == "GET") {
          const records = await conn.fetchRecords();

          res
            .setHeader("Content-type", "application/json")
            .write(records ? JSON.stringify(records) : []); //write a response to the client
          res.end();
        } else {
          const requestBody = [];
          req.on("data", (chunks) => {
            console.log("🔃 Processing data chunk");
            requestBody.push(
              Buffer.from(
                Buffer.from(chunks).toString("base64"),
                "base64"
              ).toString("ascii")
            );
          });

          req.on("end", async () => {
            console.log("🔃 Writing request to DB.");
            await conn.log(
              req.url,
              headers.host,
              req.method,
              JSON.stringify(headers),
              JSON.stringify(query),
              JSON.stringify(requestBody.join(" "))
            );
            console.log("🥙 Request completed.");
          });

          res.write("Server response : "); //write a response to the client
          res.end(); //end the response
        }
      } catch (error) {
        console.log(error);
        res.write("💀 Error saving the response."); //write a response to the client
        res.end(); //end the response
      }
    })
    .listen(8080, () => {
      console.log("😀 Server running on 8080");
    });
})();
