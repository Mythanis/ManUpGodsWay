import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, startOfWeek } from "date-fns";

interface Challenge {
  id: string;
  title: string;
  description?: string;
  topic: string;
  releaseDate: string;
  createdAt: string;
  updatedAt: string;
}

interface ChallengeFormProps {
  challenge?: Challenge | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function ChallengeForm({ challenge, onSubmit, onCancel, isSubmitting = false }: ChallengeFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    topic: 'leadership',
    releaseDate: ''
  });

  // Initialize form data when challenge changes
  useEffect(() => {
    if (challenge) {
      setFormData({
        title: challenge.title,
        description: challenge.description || '',
        topic: challenge.topic,
        releaseDate: format(new Date(challenge.releaseDate), 'yyyy-MM-dd')
      });
    } else {
      setFormData({
        title: '',
        description: '',
        topic: 'leadership',
        releaseDate: ''
      });
    }
  }, [challenge]);

  const getMondayDisplay = (releaseDate: string) => {
    const date = new Date(releaseDate);
    return format(date, 'MMM d, yyyy');
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.releaseDate) {
      return;
    }

    // Parse the selected date and convert to Monday at noon UTC to avoid timezone issues
    const selectedDate = new Date(formData.releaseDate + 'T12:00:00.000Z');
    
    // If the selected date is already a Monday, use it directly
    // Otherwise, find the Monday of that week
    let mondayOfWeek;
    if (selectedDate.getUTCDay() === 1) { // 1 = Monday
      mondayOfWeek = selectedDate;
    } else {
      mondayOfWeek = startOfWeek(selectedDate, { weekStartsOn: 1 });
      // Set to noon UTC to ensure the date doesn't shift due to timezone differences
      mondayOfWeek.setUTCHours(12, 0, 0, 0);
    }
    
    const challengeData = {
      ...formData,
      releaseDate: mondayOfWeek.toISOString()
    };

    onSubmit(challengeData);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Title *</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Enter challenge title"
          className="mt-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Enter challenge description"
          className="mt-2"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Topic</label>
          <Select 
            value={formData.topic} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, topic: value }))}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="leadership">Leadership</SelectItem>
              <SelectItem value="marriage">Marriage</SelectItem>
              <SelectItem value="fatherhood">Fatherhood</SelectItem>
              <SelectItem value="character">Character</SelectItem>
              <SelectItem value="faith">Faith</SelectItem>
              <SelectItem value="discipline">Discipline</SelectItem>
              <SelectItem value="service">Service</SelectItem>
              <SelectItem value="growth">Growth</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">Release Date * (Will adjust to Monday)</label>
          <Input
            type="date"
            value={formData.releaseDate}
            onChange={(e) => setFormData(prev => ({ ...prev, releaseDate: e.target.value }))}
            className="mt-2"
          />
          {formData.releaseDate && (
            <p className="text-xs text-ministry-slate mt-1">
              Will be released on Monday: {getMondayDisplay(new Date(formData.releaseDate).toISOString())}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={isSubmitting || !formData.title || !formData.releaseDate}
          className="bg-ministry-gold hover:bg-ministry-gold/90"
        >
          {challenge ? 'Update' : 'Create'} Challenge
        </Button>
      </div>
    </div>
  );
}