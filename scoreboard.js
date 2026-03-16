const mysql = require('mysql');
const dotenv = require('dotenv');
dotenv.config();

let config = {
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
}

module.exports = function(app) {
    app.route('/top').post(getTopScore);
    app.route('/add').post(saveTopScore);
}

// TOP SCORES
function getTopScore(req, res) {
	let limit = req.body.limit ?? 10;
	let connection = mysql.createConnection(config);

	connection.connect(err => {
		if (err) return res.send({status:false, error:err.message});

		let query = `
			SELECT username, telegram_id, score, date
			FROM ${process.env.DB_TABLE}
			ORDER BY score DESC, date ASC
			LIMIT ${limit}
		`;

		connection.query(query, (error, results) => {
			if (error) return res.send({status:false, error:error.message});
			res.send({status:true, datas:results});
		});
	});
}

// SAVE SCORE
function saveTopScore(req, res) {
	let telegram_id = req.body.telegram_id;
	let username = req.body.username;
	let score = req.body.score;

	if (!telegram_id || !score) {
		return res.send({status:false, error:"Missing data"});
	}

	let connection = mysql.createConnection(config);

	connection.connect(err => {
		if (err) return res.send({status:false, error:err.message});

		let query = `
			INSERT INTO ${process.env.DB_TABLE}
			(telegram_id, username, score)
			VALUES ('${telegram_id}', '${username}', ${score})
		`;

		connection.query(query, err2 => {
			if (err2) return res.send({status:false, error:err2.message});
			res.send({status:true});
		});
	});
}
