import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Shield, MapPin, Users, Mail, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { insertWarGroupRegistrationSchema } from "@shared/schema";
import type { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { BackButton } from "@/components/BackButton";

const formSchema = insertWarGroupRegistrationSchema.extend({
  contactPhone: insertWarGroupRegistrationSchema.shape.contactPhone.optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function WarGroupRegister() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [cityInput, setCityInput] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      city: "",
      state: "",
      description: "",
      meetingInfo: "",
      contactEmail: "",
      contactPhone: "",
      leadershipExperience: "",
      motivation: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("POST", "/api/war-groups/register", data);
    },
    onSuccess: () => {
      toast({
        title: "Registration Submitted",
        description: "Your war group registration has been submitted for review. You'll be notified once it's approved.",
      });
      navigate("/war-groups");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit registration",
        variant: "destructive",
      });
    },
  });

  const handleCityChange = (value: string) => {
    setCityInput(value);
    form.setValue("city", value);
    if (value) {
      form.setValue("name", `Man Up God's Way - ${value}`);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="liquid-header text-white px-6 pt-12 pb-6">
        <div className="max-w-4xl mx-auto">
          <BackButton />
          <Button
            variant="ghost"
            onClick={() => navigate("/war-groups")}
            className="mb-4 text-ministry-gold-exact hover:text-yellow-300 hover:bg-white/10 rounded-sm font-black uppercase tracking-wide text-xs"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to War Groups
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-ministry-gold-exact" />
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase">Register a War Group</h1>
              <p className="text-ministry-gold-exact text-xs font-bold tracking-widest uppercase mt-1">Start a Licensed Discipleship Group</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card className="liquid-black border-2 border-ministry-gold-exact rounded-sm shadow-[4px_4px_0px_0px_rgba(252,208,0,0.3)]">
          <CardHeader>
            <CardDescription className="text-gray-300 relative z-10">
              Apply to start a licensed "Man Up God's Way" discipleship group in your city.
              All registrations are reviewed by our team before approval.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(
                  (data) => {
                    console.log('Form submitted with data:', data);
                    registerMutation.mutate(data);
                  },
                  (errors) => {
                    console.log('Form validation errors:', errors);
                    toast({
                      title: "Validation Error",
                      description: "Please fill out all required fields correctly",
                      variant: "destructive",
                    });
                  }
                )}
                className="space-y-8"
              >
                {/* Location Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-ministry-gold-exact flex items-center gap-2 uppercase tracking-tight relative z-10">
                    <MapPin className="h-5 w-5" />
                    Location Information
                  </h3>

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-bold uppercase text-xs tracking-wide relative z-10">City</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            onChange={(e) => handleCityChange(e.target.value)}
                            placeholder="e.g., Dallas"
                            className="bg-white border-2 border-black text-black rounded-sm font-medium placeholder:text-black/50"
                            data-testid="input-city"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-bold uppercase text-xs tracking-wide relative z-10">State</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., TX"
                            className="bg-white border-2 border-black text-black rounded-sm font-medium placeholder:text-black/50"
                            data-testid="input-state"
                          />
                        </FormControl>
                        <FormDescription className="text-gray-400 text-xs relative z-10">
                          Use 2-letter state code (e.g., TX, CA, NY)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-bold uppercase text-xs tracking-wide relative z-10">Group Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            readOnly
                            className="bg-gray-200 border-2 border-black text-black rounded-sm font-medium cursor-not-allowed"
                            data-testid="input-name"
                          />
                        </FormControl>
                        <FormDescription className="text-gray-400 text-xs relative z-10">
                          Auto-generated based on city name
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Group Details Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-ministry-gold-exact flex items-center gap-2 uppercase tracking-tight relative z-10">
                    <Users className="h-5 w-5" />
                    Group Details
                  </h3>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-bold uppercase text-xs tracking-wide relative z-10">Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value || ""}
                            placeholder="Describe your vision for this war group..."
                            className="bg-white border-2 border-black text-black rounded-sm font-medium min-h-[100px] placeholder:text-black/50"
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="meetingInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-bold uppercase text-xs tracking-wide relative z-10">Proposed Meeting Information</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value || ""}
                            placeholder="When and where do you plan to meet? (e.g., Every Tuesday 7pm at Community Center)"
                            className="bg-white border-2 border-black text-black rounded-sm font-medium min-h-[80px] placeholder:text-black/50"
                            data-testid="input-meeting-info"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Contact Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-ministry-gold-exact flex items-center gap-2 uppercase tracking-tight relative z-10">
                    <Mail className="h-5 w-5" />
                    Contact Information
                  </h3>

                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-bold uppercase text-xs tracking-wide relative z-10">Contact Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="your@email.com"
                            className="bg-white border-2 border-black text-black rounded-sm font-medium placeholder:text-black/50"
                            data-testid="input-contact-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-bold uppercase text-xs tracking-wide relative z-10">Contact Phone (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            type="tel"
                            placeholder="(555) 123-4567"
                            className="bg-white border-2 border-black text-black rounded-sm font-medium placeholder:text-black/50"
                            data-testid="input-contact-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Leadership Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-ministry-gold-exact flex items-center gap-2 uppercase tracking-tight relative z-10">
                    <FileText className="h-5 w-5" />
                    Leadership Information
                  </h3>

                  <FormField
                    control={form.control}
                    name="leadershipExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-bold uppercase text-xs tracking-wide relative z-10">Leadership Experience</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value || ""}
                            placeholder="Share your leadership background and experience in ministry or discipleship..."
                            className="bg-white border-2 border-black text-black rounded-sm font-medium min-h-[100px] placeholder:text-black/50"
                            data-testid="input-leadership-experience"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="motivation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-bold uppercase text-xs tracking-wide relative z-10">Why do you want to start this war group?</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value || ""}
                            placeholder="What's your vision and motivation for leading this group?"
                            className="bg-white border-2 border-black text-black rounded-sm font-medium min-h-[100px] placeholder:text-black/50"
                            data-testid="input-motivation"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/war-groups")}
                    className="flex-1 bg-white text-black border-2 border-black rounded-sm font-black uppercase tracking-wide hover:bg-gray-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={registerMutation.isPending}
                    className="flex-1 bg-[#FCD000] text-black border-2 border-black rounded-sm font-black uppercase tracking-wide hover:brightness-110 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden"
                    data-testid="button-submit-registration"
                  >
                    <span className="relative z-10">
                      {registerMutation.isPending ? "Submitting..." : "Submit Registration"}
                    </span>
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
