import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Dumbbell, Clock, Target, Calendar } from "lucide-react";
import { useLocation, Link } from "wouter";
import type { FitnessPlan, FitnessPlanExercise } from "@shared/schema";

// Type for plan with exercises included
type FitnessPlanWithExercises = FitnessPlan & { exercises: FitnessPlanExercise[] };

const daysOfWeek = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" }
];

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'strength': return '💪';
    case 'cardio': return '❤️';
    case 'flexibility': return '🤸';
    case 'general': 
    default: return '🏃';
  }
};

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

export default function ViewPlan() {
  const [location] = useLocation();
  const planId = location.split('/')[3]; // /fitness/plans/{planId}

  // Fetch plan data
  const { data: plan, isLoading, error } = useQuery<FitnessPlanWithExercises>({
    queryKey: ['api', 'fitness-plans', planId],
    queryFn: async () => {
      const response = await fetch(`/api/fitness-plans/${planId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch plan');
      return response.json();
    },
    enabled: !!planId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ministry-gold mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workout plan...</p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load workout plan</p>
          <Link href="/fitness">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Fitness
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="p-4 flex items-center justify-between">
          <Link href="/fitness">
            <Button
              variant="ghost"
              size="sm"
              className="text-ministry-gold hover:bg-ministry-gold/10"
              data-testid="button-back-to-fitness"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          
          <h1 className="text-xl font-bold text-center flex-1 mx-4 truncate">
            {plan.name}
          </h1>
          
          <Link href={`/edit-plan/${plan.id}`}>
            <Button
              size="sm"
              className="bg-ministry-gold hover:bg-ministry-gold/90 text-black"
              data-testid="button-edit-plan"
            >
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Plan Details */}
        <Card className="bg-ministry-gold border-ministry-gold">
          <CardHeader>
            <CardTitle className="text-black flex items-center gap-2">
              <Dumbbell className="w-5 h-5" />
              Plan Details
            </CardTitle>
          </CardHeader>
          <CardContent className="text-black space-y-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
              {plan.description && (
                <p className="text-black/80 mb-4">{plan.description}</p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getCategoryIcon(plan.category)}</span>
                <div>
                  <p className="text-sm font-medium">Category</p>
                  <p className="capitalize">{plan.category}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                <div>
                  <p className="text-sm font-medium">Difficulty</p>
                  <Badge className={getDifficultyColor(plan.difficulty)}>
                    {plan.difficulty}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <div>
                <p className="text-sm font-medium">Estimated Duration</p>
                <p>{plan.estimatedDuration} minutes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exercises */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Exercises ({plan.exercises?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.exercises && plan.exercises.length > 0 ? (
              plan.exercises
                .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                .map((exercise, index) => (
                  <Card key={exercise.id} className="border border-border">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Exercise Image/GIF */}
                        <div className="flex-shrink-0">
                          {exercise.imageUrl ? (
                            <img
                              src={exercise.imageUrl}
                              alt={exercise.exerciseName}
                              className="w-20 h-20 rounded-lg object-cover border border-border"
                              data-testid={`img-exercise-${exercise.exerciseId}`}
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center border border-border">
                              <Dumbbell className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Exercise Details */}
                        <div className="flex-grow space-y-3">
                          <div>
                            <h3 className="font-semibold text-lg" data-testid={`text-exercise-name-${exercise.exerciseId}`}>
                              {index + 1}. {exercise.exerciseName}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {exercise.bodyPart && (
                                <Badge variant="secondary" className="text-xs">
                                  {exercise.bodyPart}
                                </Badge>
                              )}
                              {exercise.equipment && (
                                <Badge variant="outline" className="text-xs">
                                  {exercise.equipment}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Sets, Reps, Minutes */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Sets:</span>
                                <span data-testid={`text-sets-${exercise.exerciseId}`}>{exercise.sets}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Reps:</span>
                                <span data-testid={`text-reps-${exercise.exerciseId}`}>{exercise.reps}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              {exercise.minutes && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span className="font-medium">Time:</span>
                                  <span data-testid={`text-minutes-${exercise.exerciseId}`}>{exercise.minutes} min</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Rest:</span>
                                <span>{exercise.restTime}s</span>
                              </div>
                            </div>
                          </div>

                          {/* Days of Week */}
                          {exercise.daysOfWeek && exercise.daysOfWeek.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar className="w-4 h-4" />
                                <span className="text-sm font-medium">Days:</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {daysOfWeek.map((day) => (
                                  <Badge
                                    key={day.value}
                                    variant={exercise.daysOfWeek.includes(day.value) ? "default" : "outline"}
                                    className={`text-xs ${
                                      exercise.daysOfWeek.includes(day.value) 
                                        ? "bg-ministry-gold text-black" 
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {day.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          {exercise.notes && (
                            <div>
                              <span className="text-sm font-medium">Notes:</span>
                              <p className="text-sm text-muted-foreground mt-1">{exercise.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Dumbbell className="w-12 h-12 mx-auto mb-2" />
                <p>No exercises in this plan yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}