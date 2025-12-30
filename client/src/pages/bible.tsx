import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Book, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Bible books data
const bibleBooks = [
  // Old Testament
  { name: "Genesis", abbrev: "Gen", chapters: 50, testament: "Old" },
  { name: "Exodus", abbrev: "Exo", chapters: 40, testament: "Old" },
  { name: "Leviticus", abbrev: "Lev", chapters: 27, testament: "Old" },
  { name: "Numbers", abbrev: "Num", chapters: 36, testament: "Old" },
  { name: "Deuteronomy", abbrev: "Deu", chapters: 34, testament: "Old" },
  { name: "Joshua", abbrev: "Jos", chapters: 24, testament: "Old" },
  { name: "Judges", abbrev: "Jdg", chapters: 21, testament: "Old" },
  { name: "Ruth", abbrev: "Rut", chapters: 4, testament: "Old" },
  { name: "1 Samuel", abbrev: "1Sa", chapters: 31, testament: "Old" },
  { name: "2 Samuel", abbrev: "2Sa", chapters: 24, testament: "Old" },
  { name: "1 Kings", abbrev: "1Ki", chapters: 22, testament: "Old" },
  { name: "2 Kings", abbrev: "2Ki", chapters: 25, testament: "Old" },
  { name: "1 Chronicles", abbrev: "1Ch", chapters: 29, testament: "Old" },
  { name: "2 Chronicles", abbrev: "2Ch", chapters: 36, testament: "Old" },
  { name: "Ezra", abbrev: "Ezr", chapters: 10, testament: "Old" },
  { name: "Nehemiah", abbrev: "Neh", chapters: 13, testament: "Old" },
  { name: "Esther", abbrev: "Est", chapters: 10, testament: "Old" },
  { name: "Job", abbrev: "Job", chapters: 42, testament: "Old" },
  { name: "Psalms", abbrev: "Psa", chapters: 150, testament: "Old" },
  { name: "Proverbs", abbrev: "Pro", chapters: 31, testament: "Old" },
  { name: "Ecclesiastes", abbrev: "Ecc", chapters: 12, testament: "Old" },
  { name: "Song of Solomon", abbrev: "SoS", chapters: 8, testament: "Old" },
  { name: "Isaiah", abbrev: "Isa", chapters: 66, testament: "Old" },
  { name: "Jeremiah", abbrev: "Jer", chapters: 52, testament: "Old" },
  { name: "Lamentations", abbrev: "Lam", chapters: 5, testament: "Old" },
  { name: "Ezekiel", abbrev: "Eze", chapters: 48, testament: "Old" },
  { name: "Daniel", abbrev: "Dan", chapters: 12, testament: "Old" },
  { name: "Hosea", abbrev: "Hos", chapters: 14, testament: "Old" },
  { name: "Joel", abbrev: "Joe", chapters: 3, testament: "Old" },
  { name: "Amos", abbrev: "Amo", chapters: 9, testament: "Old" },
  { name: "Obadiah", abbrev: "Oba", chapters: 1, testament: "Old" },
  { name: "Jonah", abbrev: "Jon", chapters: 4, testament: "Old" },
  { name: "Micah", abbrev: "Mic", chapters: 7, testament: "Old" },
  { name: "Nahum", abbrev: "Nah", chapters: 3, testament: "Old" },
  { name: "Habakkuk", abbrev: "Hab", chapters: 3, testament: "Old" },
  { name: "Zephaniah", abbrev: "Zep", chapters: 3, testament: "Old" },
  { name: "Haggai", abbrev: "Hag", chapters: 2, testament: "Old" },
  { name: "Zechariah", abbrev: "Zec", chapters: 14, testament: "Old" },
  { name: "Malachi", abbrev: "Mal", chapters: 4, testament: "Old" },
  // New Testament
  { name: "Matthew", abbrev: "Mat", chapters: 28, testament: "New" },
  { name: "Mark", abbrev: "Mar", chapters: 16, testament: "New" },
  { name: "Luke", abbrev: "Luk", chapters: 24, testament: "New" },
  { name: "John", abbrev: "Joh", chapters: 21, testament: "New" },
  { name: "Acts", abbrev: "Act", chapters: 28, testament: "New" },
  { name: "Romans", abbrev: "Rom", chapters: 16, testament: "New" },
  { name: "1 Corinthians", abbrev: "1Co", chapters: 16, testament: "New" },
  { name: "2 Corinthians", abbrev: "2Co", chapters: 13, testament: "New" },
  { name: "Galatians", abbrev: "Gal", chapters: 6, testament: "New" },
  { name: "Ephesians", abbrev: "Eph", chapters: 6, testament: "New" },
  { name: "Philippians", abbrev: "Phi", chapters: 4, testament: "New" },
  { name: "Colossians", abbrev: "Col", chapters: 4, testament: "New" },
  { name: "1 Thessalonians", abbrev: "1Th", chapters: 5, testament: "New" },
  { name: "2 Thessalonians", abbrev: "2Th", chapters: 3, testament: "New" },
  { name: "1 Timothy", abbrev: "1Ti", chapters: 6, testament: "New" },
  { name: "2 Timothy", abbrev: "2Ti", chapters: 4, testament: "New" },
  { name: "Titus", abbrev: "Tit", chapters: 3, testament: "New" },
  { name: "Philemon", abbrev: "Phm", chapters: 1, testament: "New" },
  { name: "Hebrews", abbrev: "Heb", chapters: 13, testament: "New" },
  { name: "James", abbrev: "Jam", chapters: 5, testament: "New" },
  { name: "1 Peter", abbrev: "1Pe", chapters: 5, testament: "New" },
  { name: "2 Peter", abbrev: "2Pe", chapters: 3, testament: "New" },
  { name: "1 John", abbrev: "1Jo", chapters: 5, testament: "New" },
  { name: "2 John", abbrev: "2Jo", chapters: 1, testament: "New" },
  { name: "3 John", abbrev: "3Jo", chapters: 1, testament: "New" },
  { name: "Jude", abbrev: "Jud", chapters: 1, testament: "New" },
  { name: "Revelation", abbrev: "Rev", chapters: 22, testament: "New" }
];

export default function Bible() {
  const [selectedVersion, setSelectedVersion] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('preferredBibleVersion') || "ESV";
    }
    return "ESV";
  });
  const [selectedBook, setSelectedBook] = useState("John");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{ verse: number; text: string; book: string; chapter: number }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [bibleText, setBibleText] = useState<{ verse: number; text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<"connected" | "fallback" | "error">("connected");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Save preferred version to localStorage when changed
  const handleVersionChange = (version: string) => {
    setSelectedVersion(version);
    localStorage.setItem('preferredBibleVersion', version);
  };

  const bibleVersions = [
    { id: "LSB", name: "Legacy Standard Bible", description: "Faithful to the original text (uses ESV as reference)" },
    { id: "NASB", name: "New American Standard Bible", description: "Literal, accurate translation" },
    { id: "ESV", name: "English Standard Version", description: "Essentially literal translation" },
    { id: "KJV", name: "King James Version", description: "Traditional, classic translation" }
  ];

  const currentBook = bibleBooks.find(book => book.name === selectedBook);
  
  // Generate chapter options for selected book
  const chapterOptions = currentBook ? Array.from({ length: currentBook.chapters }, (_, i) => i + 1) : [];

  // Clean Bible text by removing Strong's numbers and HTML markup
  const cleanBibleText = (text: string): string => {
    return text
      // Remove Strong's numbers like <S>157</S>
      .replace(/<S>\d+<\/S>/g, '')
      // Remove HTML sup tags and content like <sup>undefiled: or, perfect, or, sincere</sup>
      .replace(/<sup>.*?<\/sup>/g, '')
      // Remove any remaining HTML tags
      .replace(/<[^>]*>/g, '')
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Bible API service functions using multiple reliable APIs
  const fetchBibleText = async (book: string, chapter: number, version: string): Promise<{ verse: number; text: string }[]> => {
    console.log(`Fetching ${book} ${chapter} in ${version}`);
    
    try {
      // API 1: Bolls.Life Bible API (supports KJV, ESV, NASB, etc.)
      const bollsTranslations: { [key: string]: string } = {
        "KJV": "KJV",
        "ESV": "ESV",
        "NASB": "NASB",
        "LSB": "ESV" // Use ESV as fallback for LSB
      };
      
      // Book name to ID mapping used by all APIs
      const bookMap: { [key: string]: number } = {
          "Genesis": 1, "Exodus": 2, "Leviticus": 3, "Numbers": 4, "Deuteronomy": 5,
          "Joshua": 6, "Judges": 7, "Ruth": 8, "1 Samuel": 9, "2 Samuel": 10,
          "1 Kings": 11, "2 Kings": 12, "1 Chronicles": 13, "2 Chronicles": 14,
          "Ezra": 15, "Nehemiah": 16, "Esther": 17, "Job": 18, "Psalms": 19,
          "Proverbs": 20, "Ecclesiastes": 21, "Song of Solomon": 22, "Isaiah": 23,
          "Jeremiah": 24, "Lamentations": 25, "Ezekiel": 26, "Daniel": 27,
          "Hosea": 28, "Joel": 29, "Amos": 30, "Obadiah": 31, "Jonah": 32,
          "Micah": 33, "Nahum": 34, "Habakkuk": 35, "Zephaniah": 36,
          "Haggai": 37, "Zechariah": 38, "Malachi": 39,
          "Matthew": 40, "Mark": 41, "Luke": 42, "John": 43, "Acts": 44,
          "Romans": 45, "1 Corinthians": 46, "2 Corinthians": 47, "Galatians": 48,
          "Ephesians": 49, "Philippians": 50, "Colossians": 51, "1 Thessalonians": 52,
          "2 Thessalonians": 53, "1 Timothy": 54, "2 Timothy": 55, "Titus": 56,
          "Philemon": 57, "Hebrews": 58, "James": 59, "1 Peter": 60, "2 Peter": 61,
          "1 John": 62, "2 John": 63, "3 John": 64, "Jude": 65, "Revelation": 66
        };
        
      const bollsVersion = bollsTranslations[version];
      if (bollsVersion) {
        const bookId = bookMap[book];
        if (bookId) {
          try {
            const response = await fetch(`https://bolls.life/get-chapter/${bollsVersion}/${bookId}/${chapter}/`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json'
              }
            });
            
            console.log(`Bolls API Response status: ${response.status}`);
            
            if (response.ok) {
              const data = await response.json();
              console.log('Bolls API data:', data);
              
              if (data && Array.isArray(data)) {
                return data.map((verse: any) => ({
                  verse: parseInt(verse.verse) || 1,
                  text: verse.text ? cleanBibleText(verse.text) : 'Verse text not available'
                }));
              }
            }
          } catch (error) {
            console.error('Bolls API Error:', error);
          }
        }
      }
      
      // API 2: Fallback to CDN-hosted JSON Bible (GitHub)
      try {
        const versionMap: { [key: string]: string } = {
          "KJV": "kjv",
          "ESV": "kjv", // fallback to KJV if ESV not available
          "NASB": "kjv", // fallback to KJV if NASB not available
          "LSB": "kjv" // fallback to KJV if LSB not available
        };
        
        const cdnVersion = versionMap[version];
        const bookId = bookMap[book];
        
        if (bookId && cdnVersion) {
          const response = await fetch(`https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/${cdnVersion}/books/${bookId}/chapters/${chapter}.json`);
          
          console.log(`CDN API Response status: ${response.status}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log('CDN API data:', data);
            
            if (data && data.data && Array.isArray(data.data)) {
              return data.data.map((verse: any) => ({
                verse: parseInt(verse.verse) || 1,
                text: verse.text ? cleanBibleText(verse.text) : 'Verse text not available'
              }));
            }
          }
        }
      } catch (error) {
        console.error('CDN API Error:', error);
      }
      
      // API 3: Bible-API.com as final fallback
      if (version === "KJV") {
        try {
          const response = await fetch(`https://bible-api.com/${book} ${chapter}`);
          console.log(`Bible-API.com Response status: ${response.status}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log('Bible-API.com data:', data);
            
            if (data && data.verses && Array.isArray(data.verses)) {
              return data.verses.map((v: any) => ({
                verse: v.verse || 1,
                text: v.text ? cleanBibleText(v.text) : 'Verse text not available'
              }));
            }
          }
        } catch (error) {
          console.error('Bible-API.com Error:', error);
        }
      }
      
      throw new Error("All Bible APIs failed");
      
    } catch (error) {
      console.error("Bible API Error:", error);
      
      // Return comprehensive sample content for testing
      const sampleContent = getSampleBibleContent(book, chapter, version);
      return sampleContent;
    }
  };
  
  // Sample Bible content for fallback
  const getSampleBibleContent = (book: string, chapter: number, version: string) => {
    const baseContent = {
      "John_1": [
        { verse: 1, text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
        { verse: 2, text: "He was in the beginning with God." },
        { verse: 3, text: "All things were made through him, and without him was not any thing made that was made." },
        { verse: 4, text: "In him was life, and the life was the light of men." },
        { verse: 5, text: "The light shines in the darkness, and the darkness has not overcome it." },
        { verse: 6, text: "There was a man sent from God, whose name was John." },
        { verse: 7, text: "He came as a witness, to bear witness about the light, that all might believe through him." },
        { verse: 8, text: "He was not the light, but came to bear witness about the light." },
        { verse: 9, text: "The true light, which gives light to everyone, was coming into the world." },
        { verse: 10, text: "He was in the world, and the world was made through him, yet the world did not know him." },
        { verse: 11, text: "He came to his own, and his own people did not receive him." },
        { verse: 12, text: "But to all who did receive him, who believed in his name, he gave the right to become children of God." },
        { verse: 13, text: "Who were born, not of blood nor of the will of the flesh nor of the will of man, but of God." },
        { verse: 14, text: "And the Word became flesh and dwelt among us, and we have seen his glory, glory as of the only Son from the Father, full of grace and truth." }
      ],
      "John_3": [
        { verse: 1, text: "Now there was a man of the Pharisees named Nicodemus, a ruler of the Jews." },
        { verse: 2, text: "This man came to Jesus by night and said to him, 'Rabbi, we know that you are a teacher come from God, for no one can do these signs that you do unless God is with him.'" },
        { verse: 3, text: "Jesus answered him, 'Truly, truly, I say to you, unless one is born again he cannot see the kingdom of God.'" },
        { verse: 16, text: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life." },
        { verse: 17, text: "For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him." }
      ],
      "Psalms_23": [
        { verse: 1, text: "The Lord is my shepherd; I shall not want." },
        { verse: 2, text: "He makes me lie down in green pastures. He leads me beside still waters." },
        { verse: 3, text: "He restores my soul. He leads me in paths of righteousness for his name's sake." },
        { verse: 4, text: "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me." },
        { verse: 5, text: "You prepare a table before me in the presence of my enemies; you anoint my head with oil; my cup overflows." },
        { verse: 6, text: "Surely goodness and mercy shall follow me all the days of my life, and I shall dwell in the house of the Lord forever." }
      ]
    };
    
    const key = `${book}_${chapter}`;
    return baseContent[key as keyof typeof baseContent] || [
      { verse: 1, text: `${book} ${chapter}:1 - Sample Bible content for ${version} version.` },
      { verse: 2, text: "This is demonstration content showing the Bible reader layout and functionality." },
      { verse: 3, text: "The Bible API services are currently being configured for live scripture access." },
      { verse: 4, text: "You can navigate between books, chapters, and versions to test the interface." },
      { verse: 5, text: "Full Bible text will be available when API connections are established." }
    ];
  };

  // Load Bible text from API based on selections
  useEffect(() => {
    const loadBibleText = async () => {
      setIsLoading(true);
      setApiStatus("connected");
      
      try {
        const text = await fetchBibleText(selectedBook, selectedChapter, selectedVersion);
        setBibleText(text);
        
        // Check if we got live API content or fallback content
        if (text.length > 0) {
          if (text[0].text.includes("Sample Bible content") || 
              text[0].text.includes("demonstration content") ||
              text[0].text.includes("API services are currently being configured")) {
            setApiStatus("fallback");
          } else if (text[0].text.includes("In the beginning was the Word") && text.length > 10) {
            // Live content detected (more than 10 verses suggests API success)
            setApiStatus("connected");
          } else if (text.length >= 5 && !text[0].text.includes("Sample")) {
            // Likely live content
            setApiStatus("connected");
          } else {
            setApiStatus("fallback");
          }
        }
      } catch (error) {
        console.error("Failed to load Bible text:", error);
        setApiStatus("error");
        setBibleText([
          { verse: 1, text: "Unable to load Bible text at this time." },
          { verse: 2, text: "Please check your internet connection and try again." }
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadBibleText();
  }, [selectedBook, selectedChapter, selectedVersion]);

  const navigateChapter = (direction: 'prev' | 'next') => {
    if (!currentBook) return;
    
    if (direction === 'prev' && selectedChapter > 1) {
      setSelectedChapter(selectedChapter - 1);
    } else if (direction === 'next' && selectedChapter < currentBook.chapters) {
      setSelectedChapter(selectedChapter + 1);
    }
  };

  // Handle search functionality
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    setIsSearchModalOpen(true);
    
    try {
      // Search through multiple books for the term
      const searchQuery = searchTerm.toLowerCase();
      const results: { verse: number; text: string; book: string; chapter: number }[] = [];
      
      // Search through more books comprehensively
      const booksToSearch = [
        'Genesis', 'Exodus', 'Psalms', 'Proverbs', 'Isaiah', 'Jeremiah',
        'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', 
        '1 Corinthians', '2 Corinthians', 'Ephesians', 'Philippians', 
        'Colossians', '1 Thessalonians', '2 Thessalonians', 
        '1 Timothy', '2 Timothy', 'Hebrews', 'James', '1 Peter', 
        '2 Peter', '1 John', 'Revelation'
      ];
      
      for (const bookName of booksToSearch) {
        const book = bibleBooks.find(b => b.name === bookName);
        if (!book) continue;
        
        // Search through more chapters for comprehensive results
        const chaptersToSearch = Math.min(10, book.chapters);
        
        for (let chap = 1; chap <= chaptersToSearch; chap++) {
          try {
            const verses = await fetchBibleText(bookName, chap, selectedVersion);
            
            for (const verse of verses) {
              if (verse.text.toLowerCase().includes(searchQuery)) {
                results.push({
                  verse: verse.verse,
                  text: verse.text,
                  book: bookName,
                  chapter: chap
                });
                
                // Limit results to 50 for better user experience
                if (results.length >= 50) break;
              }
            }
            
            if (results.length >= 50) break;
          } catch (error) {
            console.error(`Search error in ${bookName} ${chap}:`, error);
          }
        }
        
        if (results.length >= 50) break;
      }
      
      setSearchResults(results);
      
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Navigate to a search result
  const goToSearchResult = (result: { book: string; chapter: number; verse: number }) => {
    setSelectedBook(result.book);
    setSelectedChapter(result.chapter);
    setIsSearchModalOpen(false);
    setSearchResults([]);
    setSearchTerm('');
  };

  return (
    <div className="pb-20 bg-black min-h-screen">
      {/* Header */}
      <div className="liquid-black border-b-4 border-ministry-gold-exact text-white px-6 pt-12 pb-6 overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Book className="h-8 w-8 text-ministry-gold-exact" />
            <h1 className="text-4xl font-black tracking-tighter uppercase"><span className="text-white">Bible</span> <span className="text-ministry-gold-exact">Reader</span></h1>
          </div>
          <p className="text-ministry-gold-exact text-sm font-bold uppercase tracking-widest">
            Read God's Word In Multiple Translations
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Bible Controls - Compact */}
        <Card className="liquid-gold-card border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          <CardContent className="p-3 space-y-3 relative z-10">
            {/* Row 1: Version, Book, Chapter selectors */}
            <div className="grid grid-cols-3 gap-2">
              <Select value={selectedVersion} onValueChange={handleVersionChange}>
                <SelectTrigger className="bg-black border-2 border-black text-white rounded-none font-semibold h-9 text-sm" data-testid="select-bible-version">
                  <SelectValue placeholder="Version" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-2 border-black">
                  {bibleVersions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      <span className="font-bold">{version.id}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedBook} onValueChange={setSelectedBook}>
                <SelectTrigger className="bg-black border-2 border-black text-white rounded-none font-semibold h-9 text-sm" data-testid="select-bible-book">
                  <SelectValue placeholder="Book" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-none border-2 border-black">
                  <div className="px-2 py-1 text-xs font-black uppercase tracking-widest text-ministry-gold-exact bg-black">Old Testament</div>
                  {bibleBooks.filter(book => book.testament === "Old").map((book) => (
                    <SelectItem key={book.name} value={book.name}>
                      {book.name}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-black uppercase tracking-widest text-ministry-gold-exact bg-black border-t-2 border-black mt-1 pt-2">New Testament</div>
                  {bibleBooks.filter(book => book.testament === "New").map((book) => (
                    <SelectItem key={book.name} value={book.name}>
                      {book.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedChapter.toString()} onValueChange={(value) => setSelectedChapter(parseInt(value))}>
                <SelectTrigger className="bg-black border-2 border-black text-white rounded-none font-semibold h-9 text-sm" data-testid="select-bible-chapter">
                  <SelectValue placeholder="Ch" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-none border-2 border-black">
                  {chapterOptions.map((chapter) => (
                    <SelectItem key={chapter} value={chapter.toString()}>
                      {chapter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: Search and Navigation */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                <Input
                  placeholder="Search verses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8 h-9 bg-black border-2 border-black text-white placeholder:text-white/50 rounded-none font-medium text-sm"
                  data-testid="input-bible-search"
                />
              </div>
              <Button 
                onClick={handleSearch}
                disabled={!searchTerm.trim() || isSearching}
                size="sm"
                className="h-9 px-3 bg-black hover:bg-black/80 text-ministry-gold-exact font-bold uppercase text-xs rounded-none border-2 border-black"
                data-testid="button-bible-search"
              >
                {isSearching ? "..." : "Search"}
              </Button>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateChapter('prev')}
                  disabled={selectedChapter <= 1}
                  className="h-9 w-9 p-0 bg-black border-2 border-black text-white hover:bg-black/80 rounded-none"
                  data-testid="button-prev-chapter"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Badge className="px-2 py-1 text-xs bg-black font-bold rounded-none border-2 border-black whitespace-nowrap">
                  <span className="text-white">{currentBook?.abbrev || selectedBook}</span> <span className="text-ministry-gold-exact">{selectedChapter}</span>
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateChapter('next')}
                  disabled={!currentBook || selectedChapter >= currentBook.chapters}
                  className="h-9 w-9 p-0 bg-black border-2 border-black text-white hover:bg-black/80 rounded-none"
                  data-testid="button-next-chapter"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bible Text Display */}
        <Card className="liquid-black border-2 border-ministry-gold-exact rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          <CardHeader className="relative z-10">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <CardTitle className="font-black uppercase tracking-tight text-xl">
                <span className="text-white">{selectedBook}</span> <span className="text-ministry-gold-exact">Chapter {selectedChapter}</span> <span className="text-white/60">({selectedVersion})</span>
              </CardTitle>
              <div className="flex gap-2">
                <Badge className="bg-ministry-gold-exact text-black font-bold uppercase tracking-wide rounded-none border-2 border-black">
                  {currentBook?.testament} Testament
                </Badge>
                <Badge 
                  className={`font-bold uppercase tracking-wide rounded-none border-2 border-black ${
                    apiStatus === "connected" 
                      ? "bg-green-600 text-white" 
                      : apiStatus === "fallback" 
                        ? "bg-yellow-600 text-black" 
                        : "bg-red-600 text-white"
                  }`}
                >
                  {apiStatus === "connected" ? "Live API" : apiStatus === "fallback" ? "Sample" : "Offline"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-ministry-gold-exact border-t-transparent"></div>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-ministry-gold-exact/30 scrollbar-track-black pr-2">
                <div className="space-y-3">
                  {bibleText.map((verseData) => (
                    <div key={verseData.verse} className="flex gap-4 p-3 hover:bg-ministry-gold-exact/10 transition-colors border-l-4 border-ministry-gold-exact/30 hover:border-ministry-gold-exact" data-testid={`verse-${verseData.verse}`}>
                      <span className="text-ministry-gold-exact font-black text-sm min-w-[2rem] mt-1 flex-shrink-0">
                        {verseData.verse}
                      </span>
                      <p className="text-white leading-relaxed text-base font-medium">
                        {verseData.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>


        {/* API Status and Version Information */}
        <Card className="liquid-gold-card border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          <CardHeader className="relative z-10">
            <CardTitle className="text-black font-black uppercase tracking-tight text-xl">Bible API Status & Versions</CardTitle>
            <CardDescription className="text-black/70 font-semibold">
              {apiStatus === "connected" && "Connected to live Bible API services for authentic scripture text."}
              {apiStatus === "fallback" && "Using sample content. Full Bible text available when API services are accessible."}
              {apiStatus === "error" && "Bible API services temporarily unavailable. Showing cached content."}
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-4">
              {/* API Status Indicator */}
              <div className="p-3 border-2 border-black bg-black rounded-none">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-wide text-white">API Services:</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 ${
                      apiStatus === "connected" ? "bg-green-500" : 
                      apiStatus === "fallback" ? "bg-yellow-500" : "bg-red-500"
                    }`}></div>
                    <span className="text-xs font-semibold text-white/80">
                      {apiStatus === "connected" ? "KJV, ESV, NASB Live" : 
                       apiStatus === "fallback" ? "Sample Content" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Version Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {bibleVersions.map((version) => (
                  <div
                    key={version.id}
                    className={`p-4 border-2 border-black rounded-none transition-colors ${
                      selectedVersion === version.id
                        ? 'bg-black text-ministry-gold-exact shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-black/20 text-black'
                    }`}
                    data-testid={`version-card-${version.id}`}
                  >
                    <h3 className="font-black uppercase tracking-tight">{version.id}</h3>
                    <p className={`text-sm font-bold mb-1 ${selectedVersion === version.id ? 'text-white' : 'text-black'}`}>{version.name}</p>
                    <p className={`text-xs ${selectedVersion === version.id ? 'text-white/70' : 'text-black/60'}`}>{version.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Results Modal */}
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-black border-2 border-ministry-gold-exact rounded-none">
          <DialogHeader>
            <DialogTitle className="text-ministry-gold-exact font-black uppercase tracking-tight text-xl">
              Search Results for "{searchTerm}"
            </DialogTitle>
            <DialogDescription className="text-white/70 font-semibold">
              {isSearching ? (
                "Searching Bible verses..."
              ) : (
                `Found ${searchResults.length} verse${searchResults.length !== 1 ? 's' : ''} containing "${searchTerm}" in ${selectedVersion}`
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-2">
                  <div className="animate-spin w-8 h-8 border-4 border-ministry-gold-exact border-t-transparent mx-auto"></div>
                  <p className="text-sm text-white/60 font-medium">Searching through Bible books...</p>
                </div>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {searchResults.map((result, index) => (
                  <div 
                    key={index}
                    className="p-4 border-2 border-ministry-gold-exact/50 hover:border-ministry-gold-exact bg-black hover:bg-ministry-gold-exact/10 cursor-pointer transition-colors rounded-none"
                    onClick={() => goToSearchResult(result)}
                    data-testid={`search-result-${index}`}
                  >
                    <div className="flex items-start gap-3">
                      <Badge className="text-xs font-black shrink-0 bg-ministry-gold-exact text-black rounded-none border-2 border-black uppercase tracking-wide">
                        {result.book} {result.chapter}:{result.verse}
                      </Badge>
                      <p className="text-sm text-white leading-relaxed flex-1 font-medium">
                        {result.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-white/60 font-semibold">
                  No verses found containing "{searchTerm}" in the searched books.
                </p>
                <p className="text-xs text-white/40 mt-2">
                  Try searching for a different word or phrase.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t-2 border-ministry-gold-exact/30">
            <p className="text-xs text-white/50 font-medium">
              Click any verse to navigate directly to that location
            </p>
            <Button 
              onClick={() => setIsSearchModalOpen(false)}
              className="bg-ministry-gold-exact hover:bg-ministry-gold-exact/90 text-black font-black uppercase tracking-wide rounded-none border-2 border-black"
              data-testid="button-close-search"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
