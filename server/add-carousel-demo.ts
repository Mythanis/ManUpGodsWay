import { db } from './db';
import { carouselItems } from '../shared/schema';
import { readFileSync } from 'fs';

async function addCarouselItems() {
  try {
    console.log('Adding demo carousel items...');
    
    const image1 = readFileSync('/tmp/carousel1_dataurl.txt', 'utf-8').trim();
    const image2 = readFileSync('/tmp/carousel2_dataurl.txt', 'utf-8').trim();
    const image3 = readFileSync('/tmp/carousel3_dataurl.txt', 'utf-8').trim();

    // Insert carousel item 1: Large top image for Bible Studies
    await db.insert(carouselItems).values({
      title: 'Explore Bible Studies',
      description: 'Dive deep into God\'s Word with our comprehensive Bible study materials',
      imageUrl: image1,
      linkType: 'video',
      linkId: null,
      position: 1,
      isActive: true,
      displayOrder: 0,
    });
    console.log('✓ Added carousel item 1: Explore Bible Studies (Large top)');

    // Insert carousel item 2: Small bottom left for Daily Devotionals
    await db.insert(carouselItems).values({
      title: 'Daily Prayer',
      description: null,
      imageUrl: image2,
      linkType: 'devotional',
      linkId: null,
      position: 2,
      isActive: true,
      displayOrder: 1,
    });
    console.log('✓ Added carousel item 2: Daily Prayer (Small bottom left)');

    // Insert carousel item 3: Small bottom right for Challenges
    await db.insert(carouselItems).values({
      title: 'Weekly Challenges',
      description: null,
      imageUrl: image3,
      linkType: 'challenge',
      linkId: null,
      position: 3,
      isActive: true,
      displayOrder: 2,
    });
    console.log('✓ Added carousel item 3: Weekly Challenges (Small bottom right)');

    console.log('\n✅ Successfully added 3 carousel items!');
    console.log('Visit your home page to see the carousel.');
    process.exit(0);
  } catch (error) {
    console.error('Error adding carousel items:', error);
    process.exit(1);
  }
}

addCarouselItems();
