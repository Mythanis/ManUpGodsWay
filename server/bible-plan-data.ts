export interface PlanDay {
  dayNumber: number;
  title: string;
  passages: string;
}

const SEQUENTIAL_BOOKS = [
  { name: "Genesis", chapters: 50 },
  { name: "Exodus", chapters: 40 },
  { name: "Leviticus", chapters: 27 },
  { name: "Numbers", chapters: 36 },
  { name: "Deuteronomy", chapters: 34 },
  { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 },
  { name: "Ruth", chapters: 4 },
  { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 },
  { name: "1 Kings", chapters: 22 },
  { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 },
  { name: "2 Chronicles", chapters: 36 },
  { name: "Ezra", chapters: 10 },
  { name: "Nehemiah", chapters: 13 },
  { name: "Esther", chapters: 10 },
  { name: "Job", chapters: 42 },
  { name: "Psalms", chapters: 150 },
  { name: "Proverbs", chapters: 31 },
  { name: "Ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", chapters: 8 },
  { name: "Isaiah", chapters: 66 },
  { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 },
  { name: "Ezekiel", chapters: 48 },
  { name: "Daniel", chapters: 12 },
  { name: "Hosea", chapters: 14 },
  { name: "Joel", chapters: 3 },
  { name: "Amos", chapters: 9 },
  { name: "Obadiah", chapters: 1 },
  { name: "Jonah", chapters: 4 },
  { name: "Micah", chapters: 7 },
  { name: "Nahum", chapters: 3 },
  { name: "Habakkuk", chapters: 3 },
  { name: "Zephaniah", chapters: 3 },
  { name: "Haggai", chapters: 2 },
  { name: "Zechariah", chapters: 14 },
  { name: "Malachi", chapters: 4 },
  { name: "Matthew", chapters: 28 },
  { name: "Mark", chapters: 16 },
  { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 },
  { name: "Acts", chapters: 28 },
  { name: "Romans", chapters: 16 },
  { name: "1 Corinthians", chapters: 16 },
  { name: "2 Corinthians", chapters: 13 },
  { name: "Galatians", chapters: 6 },
  { name: "Ephesians", chapters: 6 },
  { name: "Philippians", chapters: 4 },
  { name: "Colossians", chapters: 4 },
  { name: "1 Thessalonians", chapters: 5 },
  { name: "2 Thessalonians", chapters: 3 },
  { name: "1 Timothy", chapters: 6 },
  { name: "2 Timothy", chapters: 4 },
  { name: "Titus", chapters: 3 },
  { name: "Philemon", chapters: 1 },
  { name: "Hebrews", chapters: 13 },
  { name: "James", chapters: 5 },
  { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 },
  { name: "1 John", chapters: 5 },
  { name: "2 John", chapters: 1 },
  { name: "3 John", chapters: 1 },
  { name: "Jude", chapters: 1 },
  { name: "Revelation", chapters: 22 },
];

const CHRONOLOGICAL_BOOKS = [
  { name: "Job", chapters: 42 },
  { name: "Genesis", chapters: 50 },
  { name: "Exodus", chapters: 40 },
  { name: "Leviticus", chapters: 27 },
  { name: "Numbers", chapters: 36 },
  { name: "Deuteronomy", chapters: 34 },
  { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 },
  { name: "Ruth", chapters: 4 },
  { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 },
  { name: "Psalms", chapters: 150 },
  { name: "Proverbs", chapters: 31 },
  { name: "Ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", chapters: 8 },
  { name: "1 Kings", chapters: 22 },
  { name: "Amos", chapters: 9 },
  { name: "Hosea", chapters: 14 },
  { name: "Jonah", chapters: 4 },
  { name: "Micah", chapters: 7 },
  { name: "Isaiah", chapters: 66 },
  { name: "Nahum", chapters: 3 },
  { name: "Zephaniah", chapters: 3 },
  { name: "Habakkuk", chapters: 3 },
  { name: "Joel", chapters: 3 },
  { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 },
  { name: "2 Chronicles", chapters: 36 },
  { name: "Obadiah", chapters: 1 },
  { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 },
  { name: "Ezekiel", chapters: 48 },
  { name: "Daniel", chapters: 12 },
  { name: "Haggai", chapters: 2 },
  { name: "Zechariah", chapters: 14 },
  { name: "Ezra", chapters: 10 },
  { name: "Nehemiah", chapters: 13 },
  { name: "Esther", chapters: 10 },
  { name: "Malachi", chapters: 4 },
  { name: "Matthew", chapters: 28 },
  { name: "Mark", chapters: 16 },
  { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 },
  { name: "Acts", chapters: 28 },
  { name: "James", chapters: 5 },
  { name: "Galatians", chapters: 6 },
  { name: "1 Thessalonians", chapters: 5 },
  { name: "2 Thessalonians", chapters: 3 },
  { name: "1 Corinthians", chapters: 16 },
  { name: "2 Corinthians", chapters: 13 },
  { name: "Romans", chapters: 16 },
  { name: "Ephesians", chapters: 6 },
  { name: "Philippians", chapters: 4 },
  { name: "Colossians", chapters: 4 },
  { name: "Philemon", chapters: 1 },
  { name: "1 Timothy", chapters: 6 },
  { name: "Titus", chapters: 3 },
  { name: "2 Timothy", chapters: 4 },
  { name: "Hebrews", chapters: 13 },
  { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 },
  { name: "1 John", chapters: 5 },
  { name: "2 John", chapters: 1 },
  { name: "3 John", chapters: 1 },
  { name: "Jude", chapters: 1 },
  { name: "Revelation", chapters: 22 },
];

function generatePlanFromBooks(
  books: Array<{ name: string; chapters: number }>,
  totalDays: number = 365
): PlanDay[] {
  const allChapters: Array<{ book: string; chapter: number }> = [];
  for (const book of books) {
    for (let ch = 1; ch <= book.chapters; ch++) {
      allChapters.push({ book: book.name, chapter: ch });
    }
  }

  const totalChapters = allChapters.length;
  const days: PlanDay[] = [];
  let chapterIndex = 0;

  for (let day = 1; day <= totalDays; day++) {
    const targetEnd = Math.round((day / totalDays) * totalChapters);
    const endIndex = Math.min(targetEnd, totalChapters);
    const todayChapters = allChapters.slice(chapterIndex, endIndex);
    chapterIndex = endIndex;

    if (todayChapters.length === 0) {
      days.push({ dayNumber: day, title: "Review & Reflection", passages: "Review & Reflection" });
      continue;
    }

    const segments: string[] = [];
    let segStart = 0;
    while (segStart < todayChapters.length) {
      const book = todayChapters[segStart].book;
      let segEnd = segStart;
      while (segEnd < todayChapters.length && todayChapters[segEnd].book === book) {
        segEnd++;
      }
      const firstCh = todayChapters[segStart].chapter;
      const lastCh = todayChapters[segEnd - 1].chapter;
      segments.push(firstCh === lastCh ? `${book} ${firstCh}` : `${book} ${firstCh}–${lastCh}`);
      segStart = segEnd;
    }

    const passages = segments.join("; ");
    days.push({ dayNumber: day, title: passages, passages });
  }

  return days;
}

export function generateSequential365(): PlanDay[] {
  return generatePlanFromBooks(SEQUENTIAL_BOOKS, 365);
}

export function generateChronological365(): PlanDay[] {
  return generatePlanFromBooks(CHRONOLOGICAL_BOOKS, 365);
}
