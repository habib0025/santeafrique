const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const router = express.Router();

// Schéma de validation
const donorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  bloodType: z.enum(['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE']),
  contactPhone: z.string().regex(/^\+221[0-9]{9}$/)
});

// Création de session JWT
const createSession = async (userId) => {
    // Limitez la taille du token si nécessaire
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { 
      expiresIn: '7d',
      noTimestamp: true // Réduit légèrement la taille
    });
    
    return await prisma.session.create({
      data: {
        userId,
        token: token.slice(0, 511), // Sécurité supplémentaire
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
  };

// Route d'inscription
router.post('/register/donor', async (req, res) => {
  try {
    // Validation des données
    const validation = donorSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.issues
      });
    }

    const { email, password, bloodType, contactPhone } = validation.data;

    // Vérification de l'existence de l'email
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: "Email déjà utilisé",
        code: "EMAIL_EXISTS"
      });
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Création de l'utilisateur et du profil donneur
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'DONOR',
        donor: {
          create: {
            bloodType,
            contactPhone,
            canDonateFrom: new Date()
          }
        }
      },
      include: { donor: true }
    });

    // Création de la session JWT
    const session = await createSession(user.id);
    
    // Réponse de succès
    res.status(201).json({
      success: true,
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        donorProfile: user.donor
      }
    });
  } catch (error) {
    console.error('Détails erreur:', {
      message: error.message,
      stack: error.stack,
      fullError: JSON.stringify(error, null, 2)
    });
    
    res.status(500).json({ 
      error: "Erreur technique lors de l'inscription",
      debugId: uuidv4(),
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: "Email ou mot de passe incorrect" });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: "Email ou mot de passe incorrect" });
    }
    const session = await createSession(user.id);
    res.json({
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;