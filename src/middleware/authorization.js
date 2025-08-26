const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const { myTokenName } = req.cookies;
    if (myTokenName == null) return res.status(401).json({ error: "Null Token" });
    console.log(myTokenName);
    jwt.verify(myTokenName, process.env.JWT_SECRET, (error, user) => {
        if (error) return res.status(403).json({ error: error.message });
        req.user = user;
        next();
    })
}

//EL SECRET DEBE ESTAR EN UN .ENV

module.exports = {
    authenticateToken
};