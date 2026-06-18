import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcrypt';
import * as path from 'path';

const adapter = new PrismaBetterSqlite3({
  url: `file:${path.join(__dirname, '..', 'dev.db')}`,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('sitara123', 10);

  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Spice Garden',
      location: 'Koramangala, Bangalore',
      googlePlaceId: 'ChIJxxxxxxxxxxxxxxx',
      gatingEnabled: false,
      plan: 'growth',
      voiceSetting: 'friendly',
      recoveryOffer: '20% off your next visit',
    },
  });

  await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      email: 'owner@spicegarden.in',
      password: hashedPassword,
      name: 'Rajesh Kumar',
      role: 'owner',
    },
  });

  await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      email: 'manager@spicegarden.in',
      password: hashedPassword,
      name: 'Priya Sharma',
      role: 'manager',
    },
  });

  const reviews = [
    // Google reviews
    { source: 'google', author: 'Amit Patel', rating: 5, text: 'Best biryani in Koramangala! The flavors are absolutely incredible. Will definitely come back.', language: 'en', sentiment: 'positive', daysAgo: 1 },
    { source: 'google', author: 'Sneha Reddy', rating: 4, text: 'Good food and ambience. Service was a bit slow during peak hours but overall a great experience.', language: 'en', sentiment: 'positive', daysAgo: 2 },
    { source: 'google', author: 'Rahul Verma', rating: 5, text: 'Bahut accha khana! Paneer tikka to kamaal ka tha. Staff bhi bahut friendly hai.', language: 'hi', sentiment: 'positive', daysAgo: 3 },
    { source: 'google', author: 'Kavitha S', rating: 2, text: 'Food was cold when it arrived. Waited 45 minutes for our order. Very disappointing.', language: 'en', sentiment: 'negative', daysAgo: 4 },
    { source: 'google', author: 'Deepak Joshi', rating: 5, text: 'Amazing dal makhani and butter naan! This is our family\'s go-to restaurant now.', language: 'en', sentiment: 'positive', daysAgo: 5 },
    { source: 'google', author: 'Ananya Iyer', rating: 3, text: 'Food is decent but overpriced for the portion size. The ambience is nice though.', language: 'en', sentiment: 'neutral', daysAgo: 6 },
    { source: 'google', author: 'Vikram Singh', rating: 1, text: 'Terrible experience. Found a hair in my food. Manager was rude when I complained. Never coming back.', language: 'en', sentiment: 'negative', daysAgo: 7 },
    { source: 'google', author: 'Meera Nair', rating: 4, text: 'Loved the thali! Great value for money. The rasam was especially good.', language: 'en', sentiment: 'positive', daysAgo: 8 },
    { source: 'google', author: 'Arjun Kapoor', rating: 5, text: 'Yeh jagah ekdum top hai! Chicken tikka aur rumali roti must try hai yahan.', language: 'hi', sentiment: 'positive', daysAgo: 10 },
    { source: 'google', author: 'Fatima Khan', rating: 4, text: 'Nice place for family dinner. Kids loved the pasta section. Indian food is the star though.', language: 'en', sentiment: 'positive', daysAgo: 12 },

    // Facebook Page reviews
    { source: 'facebook', author: 'Nikhil Rao', rating: 5, text: 'Visited with family last weekend. Amazing food and the staff was so welcoming. Highly recommend the biryani!', language: 'en', sentiment: 'positive', daysAgo: 1 },
    { source: 'facebook', author: 'Shalini Gupta', rating: 4, text: 'Great place for a casual dinner. The paneer dishes are outstanding. Slightly noisy on weekends though.', language: 'en', sentiment: 'positive', daysAgo: 3 },
    { source: 'facebook', author: 'Mohammed Ali', rating: 5, text: 'Best kebabs in Bangalore! The seekh kebab and galawati are perfection. Must visit.', language: 'en', sentiment: 'positive', daysAgo: 5 },
    { source: 'facebook', author: 'Priyanka Das', rating: 2, text: 'Disappointed with the service this time. Waited too long and the food was lukewarm. Hope they improve.', language: 'en', sentiment: 'negative', daysAgo: 8 },
    { source: 'facebook', author: 'Rohan Mehta', rating: 4, text: 'Consistently good food every time we visit. The thali is unbeatable value. Love this place!', language: 'en', sentiment: 'positive', daysAgo: 11 },
    { source: 'facebook', author: 'Divya Krishnan', rating: 5, text: 'The weekend brunch buffet is absolutely worth it! So much variety and everything is fresh.', language: 'en', sentiment: 'positive', daysAgo: 14 },
    { source: 'facebook', author: 'Suresh Babu', rating: 3, text: 'Food is good but parking is a nightmare. They should really sort that out. Otherwise decent.', language: 'en', sentiment: 'neutral', daysAgo: 18 },
    { source: 'facebook', author: 'Aisha Begum', rating: 1, text: 'Terrible hygiene. Found something in my food. Will not be coming back. Very disappointed.', language: 'en', sentiment: 'negative', daysAgo: 22 },

    // WhatsApp feedback (first-party, collected via Sitara surveys)
    { source: 'whatsapp', author: '+91 98765 XXXXX', rating: 5, text: null, language: 'en', sentiment: 'positive', daysAgo: 1 },
    { source: 'whatsapp', author: '+91 87654 XXXXX', rating: 4, text: 'Loved the butter chicken!', language: 'en', sentiment: 'positive', daysAgo: 1 },
    { source: 'whatsapp', author: '+91 76543 XXXXX', rating: 2, text: 'Food was cold', language: 'en', sentiment: 'negative', daysAgo: 2 },
    { source: 'whatsapp', author: '+91 65432 XXXXX', rating: 5, text: 'Bahut accha tha! Will come again', language: 'hi', sentiment: 'positive', daysAgo: 2 },
    { source: 'whatsapp', author: '+91 54321 XXXXX', rating: 1, text: 'Slow service', language: 'en', sentiment: 'negative', daysAgo: 3 },
    { source: 'whatsapp', author: '+91 43210 XXXXX', rating: 4, text: null, language: 'en', sentiment: 'positive', daysAgo: 3 },
    { source: 'whatsapp', author: '+91 32109 XXXXX', rating: 5, text: 'Best biryani ever!', language: 'en', sentiment: 'positive', daysAgo: 4 },
    { source: 'whatsapp', author: '+91 21098 XXXXX', rating: 3, text: 'Okay food, nothing special', language: 'en', sentiment: 'neutral', daysAgo: 5 },
    { source: 'whatsapp', author: '+91 10987 XXXXX', rating: 5, text: null, language: 'en', sentiment: 'positive', daysAgo: 6 },
    { source: 'whatsapp', author: '+91 99876 XXXXX', rating: 4, text: 'Good food, friendly staff', language: 'en', sentiment: 'positive', daysAgo: 7 },
  ];

  for (const review of reviews) {
    const postedAt = new Date();
    postedAt.setDate(postedAt.getDate() - review.daysAgo);

    await prisma.review.create({
      data: {
        restaurantId: restaurant.id,
        source: review.source,
        externalId: `${review.source}_${Math.random().toString(36).slice(2, 10)}`,
        author: review.author,
        rating: review.rating,
        text: review.text,
        language: review.language,
        sentiment: review.sentiment,
        postedAt,
        replied: false,
      },
    });
  }

  // Seed demo survey data
  const surveyCustomers = [
    { phone: '+919876500001', name: 'Ravi Kumar' },
    { phone: '+919876500002', name: 'Sunita Devi' },
    { phone: '+919876500003', name: 'Manoj Tiwari' },
    { phone: '+919876500004', name: null },
    { phone: '+919876500005', name: 'Lakshmi Iyer' },
    { phone: '+919876500006', name: 'Sunil Sharma' },
    { phone: '+919876500007', name: null },
    { phone: '+919876500008', name: 'Geeta Rao' },
  ];

  const surveyData = [
    { customerIdx: 0, channel: 'pos', rating: 5, feedback: null, status: 'rated', daysAgo: 0 },
    { customerIdx: 1, channel: 'qr', rating: 4, feedback: 'Good food!', status: 'rated', daysAgo: 0 },
    { customerIdx: 2, channel: 'pos', rating: 2, feedback: 'Cold food', status: 'rated', daysAgo: 1 },
    { customerIdx: 3, channel: 'manual', rating: null, feedback: null, status: 'sent', daysAgo: 0 },
    { customerIdx: 4, channel: 'pos', rating: 5, feedback: 'Excellent!', status: 'rated', daysAgo: 2 },
    { customerIdx: 5, channel: 'qr', rating: 1, feedback: 'Terrible service', status: 'rated', daysAgo: 3 },
    { customerIdx: 6, channel: 'manual', rating: null, feedback: null, status: 'sent', daysAgo: 1 },
    { customerIdx: 7, channel: 'pos', rating: 4, feedback: null, status: 'rated', daysAgo: 4 },
  ];

  for (const sd of surveyData) {
    const cust = surveyCustomers[sd.customerIdx];
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - sd.daysAgo);

    const customer = await prisma.customer.create({
      data: {
        restaurantId: restaurant.id,
        phone: cust.phone,
        name: cust.name,
        consentAt: new Date(),
      },
    });

    await prisma.survey.create({
      data: {
        restaurantId: restaurant.id,
        customerId: customer.id,
        channel: sd.channel,
        rating: sd.rating,
        feedback: sd.feedback,
        status: sd.status,
        createdAt,
      },
    });
  }

  // Seed demo alerts (from unhappy survey ratings)
  const alertData = [
    { rating: 2, reason: 'Food was cold', phone: '+919876500003', daysAgo: 1, status: 'open' },
    { rating: 1, reason: 'Terrible service', phone: '+919876500006', daysAgo: 3, status: 'open' },
    { rating: 2, reason: null, phone: '+919876500010', daysAgo: 5, status: 'resolved', resolveNote: 'Called customer, offered 20% off next visit. Customer was happy.' },
    { rating: 1, reason: 'Found something in food', phone: '+919876500011', daysAgo: 7, status: 'resolved', resolveNote: 'Spoke to kitchen staff. Improved hygiene checks.' },
  ];

  for (const ad of alertData) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - ad.daysAgo);

    await prisma.alert.create({
      data: {
        restaurantId: restaurant.id,
        rating: ad.rating,
        reason: ad.reason,
        customerPhone: ad.phone,
        status: ad.status,
        resolveNote: ad.status === 'resolved' ? (ad as any).resolveNote : null,
        resolvedAt: ad.status === 'resolved' ? new Date() : null,
        createdAt,
      },
    });
  }

  // Seed second restaurant location for multi-location demo
  const restaurant2 = await prisma.restaurant.create({
    data: {
      name: 'Spice Garden',
      location: 'Indiranagar, Bangalore',
      googlePlaceId: 'ChIJyyyyyyyyyyyyyy',
      gatingEnabled: true,
      plan: 'growth',
      voiceSetting: 'casual',
    },
  });

  // Same owner email → enables location switching
  await prisma.user.create({
    data: {
      restaurantId: restaurant2.id,
      email: 'owner@spicegarden.in',
      password: hashedPassword,
      name: 'Rajesh Kumar',
      role: 'owner',
    },
  });

  const r2Reviews = [
    { source: 'google', author: 'Kiran N', rating: 5, text: 'Love the Indiranagar branch! Great vibe and amazing food.', language: 'en', sentiment: 'positive', daysAgo: 1 },
    { source: 'google', author: 'Tanvi R', rating: 4, text: 'Nice ambience but a bit crowded on weekends. Food is always great.', language: 'en', sentiment: 'positive', daysAgo: 3 },
    { source: 'facebook', author: 'Aditya K', rating: 5, text: 'Best new branch in Indiranagar! The rooftop seating is lovely.', language: 'en', sentiment: 'positive', daysAgo: 2 },
    { source: 'whatsapp', author: '+91 88888 XXXXX', rating: 4, text: 'Good experience', language: 'en', sentiment: 'positive', daysAgo: 1 },
  ];

  for (const review of r2Reviews) {
    const postedAt = new Date();
    postedAt.setDate(postedAt.getDate() - review.daysAgo);
    await prisma.review.create({
      data: {
        restaurantId: restaurant2.id,
        source: review.source,
        externalId: `${review.source}_${Math.random().toString(36).slice(2, 10)}`,
        author: review.author,
        rating: review.rating,
        text: review.text,
        language: review.language,
        sentiment: review.sentiment,
        postedAt,
        replied: false,
      },
    });
  }

  console.log(`Seeded: 2 restaurants, 3 users, ${reviews.length + r2Reviews.length} reviews, ${surveyData.length} surveys, ${alertData.length} alerts`);
  console.log('Login: owner@spicegarden.in / sitara123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
