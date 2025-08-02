const CustomError = require("../errors");
function requireRole(roles) {
  return (req, res, next) => {
    const userRole = req.user.role;
    if (Array.isArray(roles)) {
      console.log("User roles:", userRole, "Required roles:", roles);
      if (!roles.includes(userRole)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      if (userRole !== roles) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    next();
  };
}


module.exports = requireRole;
