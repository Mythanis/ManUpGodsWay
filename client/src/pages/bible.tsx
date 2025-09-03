import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [selectedVersion, setSelectedVersion] = useState("ESV");
  const [selectedBook, setSelectedBook] = useState("John");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [bibleText, setBibleText] = useState<{ verse: number; text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const bibleVersions = [
    { id: "LSB", name: "Legacy Standard Bible", description: "Faithful to the original text" },
    { id: "NASB", name: "New American Standard Bible", description: "Literal, accurate translation" },
    { id: "ESV", name: "English Standard Version", description: "Essentially literal translation" },
    { id: "KJV", name: "King James Version", description: "Traditional, classic translation" }
  ];

  const currentBook = bibleBooks.find(book => book.name === selectedBook);
  
  // Generate chapter options for selected book
  const chapterOptions = currentBook ? Array.from({ length: currentBook.chapters }, (_, i) => i + 1) : [];

  // Sample Bible text data (in a real implementation, this would come from an API)
  const sampleBibleText = {
    "John_1_ESV": [
      { verse: 1, text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
      { verse: 2, text: "He was in the beginning with God." },
      { verse: 3, text: "All things were made through him, and without him was not any thing made that was made." },
      { verse: 4, text: "In him was life, and the life was the light of men." },
      { verse: 5, text: "The light shines in the darkness, and the darkness has not overcome it." },
      { verse: 6, text: "There was a man sent from God, whose name was John." },
      { verse: 7, text: "He came as a witness, to bear witness about the light, that all might believe through him." },
      { verse: 8, text: "He was not the light, but came to bear witness about the light." },
      { verse: 9, text: "The true light, which gives light to everyone, was coming into the world." },
      { verse: 10, text: "He was in the world, and the world was made through him, yet the world did not know him." }
    ],
    "John_3_ESV": [
      { verse: 1, text: "Now there was a man of the Pharisees named Nicodemus, a ruler of the Jews." },
      { verse: 2, text: "This man came to Jesus by night and said to him, \"Rabbi, we know that you are a teacher come from God, for no one can do these signs that you do unless God is with him.\"" },
      { verse: 3, text: "Jesus answered him, \"Truly, truly, I say to you, unless one is born again he cannot see the kingdom of God.\"" },
      { verse: 16, text: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life." },
      { verse: 17, text: "For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him." }
    ]
  };

  // Load Bible text based on selections
  useEffect(() => {
    setIsLoading(true);
    const key = `${selectedBook}_${selectedChapter}_${selectedVersion}`;
    
    // Simulate API loading delay
    setTimeout(() => {
      const text = sampleBibleText[key as keyof typeof sampleBibleText] || [
        { verse: 1, text: `${selectedBook} ${selectedChapter}:1 - Bible text would be loaded here from ${selectedVersion} version.` },
        { verse: 2, text: "This is a placeholder for the actual Bible text content." },
        { verse: 3, text: "In a production app, this would connect to a Bible API service." }
      ];
      setBibleText(text);
      setIsLoading(false);
    }, 500);
  }, [selectedBook, selectedChapter, selectedVersion]);

  const navigateChapter = (direction: 'prev' | 'next') => {
    if (!currentBook) return;
    
    if (direction === 'prev' && selectedChapter > 1) {
      setSelectedChapter(selectedChapter - 1);
    } else if (direction === 'next' && selectedChapter < currentBook.chapters) {
      setSelectedChapter(selectedChapter + 1);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-20">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Book className="h-8 w-8 text-ministry-gold" />
            <h1 className="text-3xl font-bold text-foreground">Bible Reader</h1>
          </div>
          <p className="text-muted-foreground">
            Read God's Word in multiple translations
          </p>
        </div>

        {/* Bible Controls */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Bible Navigation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Version Selector */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Version</label>
                <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {bibleVersions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{version.id}</span>
                          <span className="text-xs text-muted-foreground">{version.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Book Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Book</label>
                <Select value={selectedBook} onValueChange={setSelectedBook}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select book" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Old Testament</div>
                    {bibleBooks.filter(book => book.testament === "Old").map((book) => (
                      <SelectItem key={book.name} value={book.name}>
                        {book.name}
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">New Testament</div>
                    {bibleBooks.filter(book => book.testament === "New").map((book) => (
                      <SelectItem key={book.name} value={book.name}>
                        {book.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Chapter Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Chapter</label>
                <Select value={selectedChapter.toString()} onValueChange={(value) => setSelectedChapter(parseInt(value))}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Chapter" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {chapterOptions.map((chapter) => (
                      <SelectItem key={chapter} value={chapter.toString()}>
                        Chapter {chapter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search verses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-background border-border"
                  />
                </div>
              </div>
            </div>

            {/* Chapter Navigation */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigateChapter('prev')}
                disabled={selectedChapter <= 1}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <Badge variant="secondary" className="px-4 py-2 text-sm">
                {selectedBook} {selectedChapter}
              </Badge>
              
              <Button
                variant="outline"
                onClick={() => navigateChapter('next')}
                disabled={!currentBook || selectedChapter >= currentBook.chapters}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bible Text Display */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-foreground">
                {selectedBook} Chapter {selectedChapter} ({selectedVersion})
              </CardTitle>
              <Badge className="bg-ministry-gold text-black">
                {currentBook?.testament} Testament
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ministry-gold"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {bibleText.map((verseData) => (
                  <div key={verseData.verse} className="flex gap-4 p-3 hover:bg-accent/5 rounded-lg transition-colors">
                    <span className="text-ministry-gold font-semibold text-sm min-w-[2rem] mt-1">
                      {verseData.verse}
                    </span>
                    <p className="text-foreground leading-relaxed text-base">
                      {verseData.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Version Information */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">About {selectedVersion}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {bibleVersions.map((version) => (
                <div
                  key={version.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    selectedVersion === version.id
                      ? 'border-ministry-gold bg-ministry-gold/10'
                      : 'border-border bg-accent/5'
                  }`}
                >
                  <h3 className="font-semibold text-foreground">{version.id}</h3>
                  <p className="text-sm font-medium text-foreground mb-1">{version.name}</p>
                  <p className="text-xs text-muted-foreground">{version.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}