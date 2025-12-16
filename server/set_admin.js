const db = require('./db');
const username = 'ns2250225'; // 替换为实际用户名
db.run("UPDATE users SET role = 'admin' WHERE username = ?", [username], (err) => {
    if (err) console.error(err.message);
    else console.log(`User ${username} is now an admin.`);
});