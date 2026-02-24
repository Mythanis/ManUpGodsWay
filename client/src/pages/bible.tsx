import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Book, ChevronLeft, ChevronRight, Search, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/BackButton";
import { useQuery } from "@tanstack/react-query";

interface BibleVersion {
  id: string;
  name: string;
  nameLocal: string;
  abbreviation: string;
  abbreviationLocal: string;
  description: string;
}

interface BibleBook {
  id: string;
  bibleId: string;
  abbreviation: string;
  name: string;
  nameLong: string;
}

interface BibleChapter {
  id: string;
  bibleId: string;
  bookId: string;
  number: string;
  reference: string;
}

interface ChapterContent {
  id: string;
  bibleId: string;
  bookId: string;
  number: string;
  reference: string;
  content: string;
  copyright: string;
}

export default function Bible() {
  const [selectedVersionId, setSelectedVersionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('preferredBibleVersionId') || "";
    }
    return "";
  });
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Fetch available Bible versions
  const { data: versions, isLoading: versionsLoading, error: versionsError } = useQuery<BibleVersion[]>({
    queryKey: ['/api/bible/versions'],
  });

  // Set default version when versions load
  useEffect(() => {
    if (versions && versions.length > 0 && !selectedVersionId) {
      const defaultVersion = versions.find(v => 
        v.abbreviation?.toLowerCase() === 'nasb1995' || 
        v.name?.toLowerCase().includes('nasb1995') ||
        v.name?.toLowerCase().includes('new american standard 1995')
      ) || versions.find(v =>
        v.abbreviation?.toLowerCase() === 'nasb' ||
        v.name?.toLowerCase().includes('new american standard')
      ) || versions[0];
      setSelectedVersionId(defaultVersion.id);
      localStorage.setItem('preferredBibleVersionId', defaultVersion.id);
    }
  }, [versions, selectedVersionId]);

  // Fetch books for selected version
  const { data: books, isLoading: booksLoading } = useQuery<BibleBook[]>({
    queryKey: ['/api/bible', selectedVersionId, 'books'],
    enabled: !!selectedVersionId,
  });

  // Set default book when books load
  useEffect(() => {
    if (books && books.length > 0 && !selectedBookId) {
      // Try to find John or first book
      const defaultBook = books.find(b => b.name?.toLowerCase() === 'john') || books[0];
      setSelectedBookId(defaultBook.id);
    }
  }, [books, selectedBookId]);

  // Fetch chapters for selected book
  const { data: chapters, isLoading: chaptersLoading } = useQuery<BibleChapter[]>({
    queryKey: ['/api/bible', selectedVersionId, 'books', selectedBookId, 'chapters'],
    enabled: !!selectedVersionId && !!selectedBookId,
  });

  // Set default chapter when chapters load
  useEffect(() => {
    if (chapters && chapters.length > 0 && !selectedChapterId) {
      // Skip intro chapter if present, get chapter 1
      const defaultChapter = chapters.find(c => c.number === '1') || chapters[0];
      setSelectedChapterId(defaultChapter.id);
    }
  }, [chapters, selectedChapterId]);

  // Fetch chapter content
  const { data: chapterContent, isLoading: contentLoading, error: contentError } = useQuery<ChapterContent>({
    queryKey: ['/api/bible', selectedVersionId, 'chapters', selectedChapterId],
    enabled: !!selectedVersionId && !!selectedChapterId,
  });

  // Search query
  const { data: searchResults, isLoading: searchLoading, refetch: executeSearch } = useQuery<any>({
    queryKey: ['/api/bible/search', selectedVersionId, searchTerm],
    queryFn: async () => {
      const response = await fetch(`/api/bible/${selectedVersionId}/search?query=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: false,
  });

  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    setSelectedBookId("");
    setSelectedChapterId("");
    localStorage.setItem('preferredBibleVersionId', versionId);
  };

  const handleBookChange = (bookId: string) => {
    setSelectedBookId(bookId);
    setSelectedChapterId("");
  };

  const handleChapterChange = (chapterId: string) => {
    setSelectedChapterId(chapterId);
  };

  const navigateChapter = (direction: 'prev' | 'next') => {
    if (!chapters || chapters.length === 0) return;
    
    const currentIndex = chapters.findIndex(c => c.id === selectedChapterId);
    if (currentIndex === -1) return;
    
    if (direction === 'prev' && currentIndex > 0) {
      setSelectedChapterId(chapters[currentIndex - 1].id);
    } else if (direction === 'next' && currentIndex < chapters.length - 1) {
      setSelectedChapterId(chapters[currentIndex + 1].id);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim() || !selectedVersionId) return;
    setIsSearchModalOpen(true);
    executeSearch();
  };

  const currentVersion = versions?.find(v => v.id === selectedVersionId);
  const currentBook = books?.find(b => b.id === selectedBookId);
  const currentChapter = chapters?.find(c => c.id === selectedChapterId);

  // Parse chapter content into verses
  const parseContent = (content: string): { verse: number; text: string }[] => {
    if (!content) return [];
    
    // The API returns content with verse numbers embedded like [1] or (1)
    // Split by verse markers and parse
    const lines = content.split(/\[(\d+)\]/).filter(Boolean);
    const verses: { verse: number; text: string }[] = [];
    
    for (let i = 0; i < lines.length; i += 2) {
      const verseNum = parseInt(lines[i]);
      const text = lines[i + 1]?.trim() || '';
      if (!isNaN(verseNum) && text) {
        verses.push({ verse: verseNum, text });
      }
    }
    
    // If parsing failed, return the whole content as one block
    if (verses.length === 0 && content) {
      return [{ verse: 1, text: content }];
    }
    
    return verses;
  };

  const verses = chapterContent ? parseContent(chapterContent.content) : [];

  const isLoading = versionsLoading || booksLoading || chaptersLoading || contentLoading;
  const hasError = versionsError || contentError;

  // Get testament groups for book selector
  const oldTestamentBooks = books?.filter(b => {
    const otBooks = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'];
    return otBooks.some(code => b.id?.toUpperCase().includes(code));
  }) || [];

  const newTestamentBooks = books?.filter(b => !oldTestamentBooks.includes(b)) || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="liquid-header text-white px-6 pt-12 pb-6">
        <div className="max-w-2xl mx-auto">
          <BackButton />
          <h1 className="text-4xl font-black tracking-tighter uppercase">
            <span className="text-white">Bible</span>{" "}
            <span className="text-ministry-gold-exact">Reader</span>
          </h1>
          <p className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase mt-2">
            Read God's Word Anytime
          </p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4 max-w-2xl mx-auto">
        {/* Bible Controls */}
        <Card className="liquid-black-white border-2 border-ministry-gold-exact rounded-sm overflow-hidden">
          <CardContent className="p-4 relative z-10">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {/* Version Selector */}
              <Select value={selectedVersionId} onValueChange={handleVersionChange}>
                <SelectTrigger className="bg-black border-2 border-ministry-gold-exact text-white rounded-sm font-semibold h-9 text-sm" data-testid="select-bible-version">
                  <SelectValue placeholder={versionsLoading ? "Loading..." : "Version"} />
                </SelectTrigger>
                <SelectContent className="bg-black border-ministry-gold-exact max-h-60">
                  {versions?.map((version) => (
                    <SelectItem key={version.id} value={version.id} className="text-white hover:bg-ministry-gold-exact/20">
                      {version.abbreviation || version.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Book Selector */}
              <Select value={selectedBookId} onValueChange={handleBookChange} disabled={!selectedVersionId}>
                <SelectTrigger className="bg-black border-2 border-ministry-gold-exact text-white rounded-sm font-semibold h-9 text-sm" data-testid="select-bible-book">
                  <SelectValue placeholder={booksLoading ? "Loading..." : "Book"} />
                </SelectTrigger>
                <SelectContent className="bg-black border-ministry-gold-exact max-h-60">
                  {oldTestamentBooks.length > 0 && (
                    <SelectItem value="__ot_header__" disabled className="text-ministry-gold-exact font-bold">
                      — Old Testament —
                    </SelectItem>
                  )}
                  {oldTestamentBooks.map((book) => (
                    <SelectItem key={book.id} value={book.id} className="text-white hover:bg-ministry-gold-exact/20">
                      {book.name}
                    </SelectItem>
                  ))}
                  {newTestamentBooks.length > 0 && (
                    <SelectItem value="__nt_header__" disabled className="text-ministry-gold-exact font-bold">
                      — New Testament —
                    </SelectItem>
                  )}
                  {newTestamentBooks.map((book) => (
                    <SelectItem key={book.id} value={book.id} className="text-white hover:bg-ministry-gold-exact/20">
                      {book.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Chapter Selector */}
              <Select value={selectedChapterId} onValueChange={handleChapterChange} disabled={!selectedBookId}>
                <SelectTrigger className="bg-black border-2 border-ministry-gold-exact text-white rounded-sm font-semibold h-9 text-sm" data-testid="select-bible-chapter">
                  <SelectValue placeholder={chaptersLoading ? "..." : "Ch"} />
                </SelectTrigger>
                <SelectContent className="bg-black border-ministry-gold-exact max-h-60">
                  {chapters?.filter(c => c.number !== 'intro').map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id} className="text-white hover:bg-ministry-gold-exact/20">
                      Chapter {chapter.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search the Bible..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-black border-2 border-ministry-gold-exact text-white rounded-sm placeholder:text-gray-500 flex-1"
                data-testid="input-bible-search"
              />
              <Button
                onClick={handleSearch}
                className="bg-ministry-gold-exact hover:bg-ministry-gold-exact/90 text-black font-bold rounded-sm border-2 border-ministry-gold-exact"
                disabled={!searchTerm.trim() || !selectedVersionId}
                data-testid="button-bible-search"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Chapter Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateChapter('prev')}
            disabled={!chapters || chapters.findIndex(c => c.id === selectedChapterId) <= 0}
            className="border-ministry-gold-exact text-ministry-gold-exact hover:bg-ministry-gold-exact hover:text-black rounded-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Prev
          </Button>
          
          <div className="text-center">
            <h2 className="text-lg font-black text-white uppercase tracking-tight">
              {currentBook?.name || "Select a Book"} {currentChapter?.number || ""}
            </h2>
            <p className="text-xs text-ministry-gold-exact font-bold">
              {currentVersion?.abbreviation || currentVersion?.name || "Select a Version"}
            </p>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateChapter('next')}
            disabled={!chapters || chapters.findIndex(c => c.id === selectedChapterId) >= chapters.length - 1}
            className="border-ministry-gold-exact text-ministry-gold-exact hover:bg-ministry-gold-exact hover:text-black rounded-sm"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Bible Text Display */}
        <Card className="liquid-black-white border-2 border-ministry-gold-exact rounded-sm overflow-hidden">
          <CardContent className="p-4 relative z-10">
            {/* API Status */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Book className="w-5 h-5 text-ministry-gold-exact" />
                <span className="text-sm font-bold text-white uppercase tracking-wide">Scripture</span>
              </div>
              <Badge className={`rounded-sm text-xs font-bold ${
                hasError ? 'bg-red-500 text-white' : 
                isLoading ? 'bg-ministry-gold-exact/50 text-black' : 
                'bg-green-600 text-white'
              }`}>
                {hasError ? 'Error' : isLoading ? 'Loading...' : 'Connected'}
              </Badge>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-ministry-gold-exact animate-spin" />
              </div>
            )}

            {/* Error State */}
            {hasError && !isLoading && (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-white font-bold mb-2">Unable to load Bible text</p>
                <p className="text-gray-400 text-sm">Please check your connection and try again</p>
              </div>
            )}

            {/* Content */}
            {!isLoading && !hasError && verses.length > 0 && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {verses.map((verse) => (
                  <div key={verse.verse} className="flex gap-3">
                    <span className="text-ministry-gold-exact font-black text-sm min-w-[2rem] text-right">
                      {verse.verse}
                    </span>
                    <p className="text-white text-base leading-relaxed flex-1">
                      {verse.text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* No Content */}
            {!isLoading && !hasError && verses.length === 0 && selectedChapterId && (
              <div className="text-center py-8">
                <Book className="w-12 h-12 text-ministry-gold-exact mx-auto mb-3" />
                <p className="text-white font-bold">Select a book and chapter to begin reading</p>
              </div>
            )}

            {/* Copyright */}
            {chapterContent?.copyright && (
              <div className="mt-4 pt-3 border-t border-ministry-gold-exact/30">
                <p className="text-gray-500 text-xs">{chapterContent.copyright}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Status Card */}
        <Card className="liquid-black-white border-2 border-ministry-gold-exact/50 rounded-sm overflow-hidden">
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-ministry-gold-exact font-black uppercase tracking-tight text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              API.Bible Connected
            </CardTitle>
            <CardDescription className="text-gray-400">
              Powered by American Bible Society's API.Bible service
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-ministry-gold-exact text-black font-bold rounded-sm">
                {versions?.length || 0} Versions Available
              </Badge>
              {currentVersion && (
                <Badge className="bg-black border border-ministry-gold-exact text-ministry-gold-exact font-bold rounded-sm">
                  Reading: {currentVersion.abbreviation || currentVersion.name}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Results Modal */}
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent className="bg-black border-2 border-ministry-gold-exact max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-ministry-gold-exact font-black uppercase tracking-tight">
              Search Results
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Results for "{searchTerm}" in {currentVersion?.abbreviation || currentVersion?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            {searchLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-ministry-gold-exact animate-spin" />
              </div>
            )}
            
            {!searchLoading && searchResults?.verses?.length > 0 ? (
              searchResults.verses.map((result: any, index: number) => (
                <Card 
                  key={index} 
                  className="bg-black/50 border border-ministry-gold-exact/50 cursor-pointer hover:border-ministry-gold-exact"
                  onClick={() => {
                    // Navigate to the verse location
                    if (result.bookId) {
                      setSelectedBookId(result.bookId);
                    }
                    if (result.chapterId) {
                      setSelectedChapterId(result.chapterId);
                    }
                    setIsSearchModalOpen(false);
                  }}
                >
                  <CardContent className="p-3">
                    <p className="text-ministry-gold-exact font-bold text-sm mb-1">
                      {result.reference}
                    </p>
                    <p className="text-white text-sm">{result.text}</p>
                  </CardContent>
                </Card>
              ))
            ) : !searchLoading && (
              <p className="text-gray-400 text-center py-8">No results found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
