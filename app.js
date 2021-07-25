const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "sfakbgjvldkj", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "sfakbgjvldkj");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
        SELECT state_id AS stateId, state_name AS stateName, population
        FROM   state;
    `;
  const statesData = await db.all(getStatesQuery);
  response.send(statesData);
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT state_id AS stateId, state_name AS stateName, population
        FROM   state
        WHERE state_id = ${stateId};
    `;
  const stateData = await db.get(getStateQuery);
  response.send(stateData);
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, active, deaths } = request.body;
  const addDistrictQuery = `
        INSERT INTO
            district(district_name, state_id, cases, cured, active, deaths)
        VALUES
            ('${districtName}', ${stateId}, '${cases}', ${cured}, '${active}', '${deaths}');
    `;
  const dbResponse = await db.run(addDistrictQuery);
  const districtId = dbResponse.lastID;
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT
            district_id AS districtId,
            district_name AS districtName,
            state_id AS stateId,
            cases,
            cured,
            active,
            deaths
        FROM
            district
        WHERE
            district_id = ${districtId};
    `;
    const districtData = await db.get(getDistrictQuery);
    response.send(districtData);
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM 
            district
        WHERE 
            district_id = ${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    UPDATE 
        district
    SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE 
        district_id = ${districtId};
  `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
        SELECT  
            SUM(cases) AS totalCases,
            SUM(cured) AS totalCured,
            SUM(active) AS  totalActive,
            SUM(deaths) AS totalDeaths
        FROM
            district
        WHERE
            state_id = ${stateId};
    `;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats[totalCases],
      totalCured: stats[totalCured],
      totalActive: stats[totalActive],
      totalDeaths: stats[totalDeaths],
    });
  }
);

module.exports = app;
