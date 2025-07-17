// middleware/roleMiddleware.js
const roles = {
    DONOR: ['DONOR'],
    HEALTH_STAFF: ['HEALTH_STAFF', 'DONOR'],
    STS_ADMIN: ['STS_ADMIN', 'HEALTH_STAFF'],
    SYSTEM_ADMIN: ['SYSTEM_ADMIN']
  };
  
  function checkRole(requiredRole) {
    return (req, res, next) => {
      const userRole = req.user.role;
      
      if (!roles[requiredRole].includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      next();
    };
  }
  
  // Usage in routes:
  router.post('/campaigns', authMiddleware, checkRole('STS_ADMIN'), campaignController.create);