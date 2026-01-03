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
  durationDays?: number;
  rationReward?: number;
  completionReward?: number;
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
    releaseDate: '',
    durationDays: 7,
    completionReward: 75
  });

  // Initialize form data when challenge changes
  useEffect(() => {
    if (challenge) {
      setFormData({
        title: challenge.title,
        description: challenge.description || '',
        topic: challenge.topic,
        releaseDate: format(new Date(challenge.releaseDate), 'yyyy-MM-dd'),
        durationDays: challenge.durationDays || 7,
        completionReward: challenge.completionReward || 75
      });
    } else {
      setFormData({
        title: '',
        description: '',
        topic: 'leadership',
        releaseDate: '',
        durationDays: 7,
        completionReward: 75
      });
    }
  }, [challenge]);

  const getMondayDisplay = (releaseDate: string) => {
    if (!releaseDate) return '';
    
    try {
      // Parse the selected date string to avoid timezone issues
      const [year, month, day] = releaseDate.split('-').map(Number);
      
      // Validate the parsed values
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return '';
      }
      
      const selectedDate = new Date(year, month - 1, day); // month is 0-indexed in JS
      
      // Check if the date is valid
      if (isNaN(selectedDate.getTime())) {
        return '';
      }
      
      let mondayOfWeek;
      
      // Check if selected date is already a Monday (1 = Monday)
      if (selectedDate.getDay() === 1) {
        // Use the selected Monday directly
        mondayOfWeek = selectedDate;
      } else {
        // Find the next Monday (not the Monday of the current week)
        const daysUntilMonday = (8 - selectedDate.getDay()) % 7 || 7;
        mondayOfWeek = new Date(selectedDate);
        mondayOfWeek.setDate(selectedDate.getDate() + daysUntilMonday);
      }
      
      // Validate the final date
      if (isNaN(mondayOfWeek.getTime())) {
        return '';
      }
      
      return format(mondayOfWeek, 'MMM d, yyyy');
    } catch (error) {
      console.error('Error in getMondayDisplay:', error);
      return '';
    }
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.releaseDate) {
      return;
    }

    // Parse the selected date string into year, month, day to avoid timezone issues
    const [year, month, day] = formData.releaseDate.split('-').map(Number);
    
    // Create date object for the selected date and find the Monday
    const selectedDate = new Date(year, month - 1, day); // month is 0-indexed in JS
    
    let mondayOfWeek;
    
    // Check if selected date is already a Monday (1 = Monday)
    if (selectedDate.getDay() === 1) {
      // Use the selected Monday directly at noon local time
      mondayOfWeek = new Date(year, month - 1, day, 12, 0, 0);
    } else {
      // Find the next Monday (not the Monday of the current week)
      const daysUntilMonday = (8 - selectedDate.getDay()) % 7 || 7;
      mondayOfWeek = new Date(selectedDate);
      mondayOfWeek.setDate(selectedDate.getDate() + daysUntilMonday);
      mondayOfWeek.setHours(12, 0, 0, 0); // Set to noon
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Duration (Days)</label>
          <Input
            type="number"
            min="1"
            max="30"
            value={formData.durationDays}
            onChange={(e) => setFormData(prev => ({ ...prev, durationDays: parseInt(e.target.value) || 7 }))}
            className="mt-2"
          />
          <p className="text-xs text-ministry-slate mt-1">
            How many days users have to complete this challenge
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">Completion Reward (Rations)</label>
          <Input
            type="number"
            min="0"
            value={formData.completionReward}
            onChange={(e) => setFormData(prev => ({ ...prev, completionReward: parseInt(e.target.value) || 75 }))}
            className="mt-2"
          />
          <p className="text-xs text-ministry-slate mt-1">
            Rations earned when user marks challenge complete
          </p>
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