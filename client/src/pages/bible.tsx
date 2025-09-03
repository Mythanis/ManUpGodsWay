import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Book, Search, Bookmark } from "lucide-react";

export default function Bible() {
  const [selectedVersion, setSelectedVersion] = useState("NIV");

  const bibleVersions = [
    { id: "NIV", name: "New International Version", description: "Modern, accurate translation" },
    { id: "ESV", name: "English Standard Version", description: "Literal, literary translation" },
    { id: "KJV", name: "King James Version", description: "Traditional, classic translation" },
    { id: "NLT", name: "New Living Translation", description: "Clear, contemporary language" },
    { id: "NASB", name: "New American Standard Bible", description: "Precise, word-for-word translation" }
  ];

  const quickAccess = [
    { name: "Daily Reading Plan", icon: Book, color: "bg-blue-600" },
    { name: "Verse Search", icon: Search, color: "bg-green-600" },
    { name: "Bookmarks", icon: Bookmark, color: "bg-purple-600" },
    { name: "Study Notes", icon: ExternalLink, color: "bg-orange-600" }
  ];

  const handleOpenBibleApp = () => {
    // Open Bible App in new tab/window
    window.open("https://www.bible.com/", "_blank");
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-20">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Book className="h-8 w-8 text-ministry-gold" />
            <h1 className="text-3xl font-bold text-foreground">Bible</h1>
          </div>
          <p className="text-muted-foreground">
            Access God's Word through the Bible App and study resources
          </p>
        </div>

        {/* Bible App Integration */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-ministry-gold" />
              Bible App Access
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Access the full Bible experience through the YouVersion Bible App
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-accent/10 rounded-lg border border-accent">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">YouVersion Bible App</h3>
                  <p className="text-sm text-muted-foreground">
                    Read, study, and share God's Word with millions worldwide
                  </p>
                </div>
                <Button 
                  onClick={handleOpenBibleApp}
                  className="bg-ministry-gold text-black hover:bg-ministry-gold/90"
                  data-testid="open-bible-app"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Bible App
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickAccess.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 p-3 bg-accent/5 rounded-lg border border-accent/20 hover:bg-accent/10 transition-colors cursor-pointer"
                    onClick={handleOpenBibleApp}
                    data-testid={`quick-access-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className={`p-2 rounded ${item.color} text-white`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-foreground">{item.name}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Bible Versions */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Popular Bible Versions</CardTitle>
            <CardDescription className="text-muted-foreground">
              Choose from various translations available in the Bible App
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bibleVersions.map((version) => (
                <div
                  key={version.id}
                  className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                    selectedVersion === version.id
                      ? 'border-ministry-gold bg-ministry-gold/10'
                      : 'border-border bg-accent/5 hover:bg-accent/10'
                  }`}
                  onClick={() => setSelectedVersion(version.id)}
                  data-testid={`version-${version.id}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-foreground">{version.id}</h3>
                    {selectedVersion === version.id && (
                      <Badge className="bg-ministry-gold text-black">Selected</Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">{version.name}</p>
                  <p className="text-xs text-muted-foreground">{version.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Bible App Features</CardTitle>
            <CardDescription className="text-muted-foreground">
              Discover powerful tools for Bible study and spiritual growth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="text-center p-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Book className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Reading Plans</h3>
                <p className="text-sm text-muted-foreground">
                  Structured plans to read through the Bible
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Search & Study</h3>
                <p className="text-sm text-muted-foreground">
                  Find verses and study with commentaries
                </p>
              </div>

              <div className="text-center p-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bookmark className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Bookmarks & Notes</h3>
                <p className="text-sm text-muted-foreground">
                  Save and organize your favorite verses
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}