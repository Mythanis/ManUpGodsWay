import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Shield, MapPin, Users, Mail, Phone, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { insertWarGroupRegistrationSchema } from "@shared/schema";
import type { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

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
      return await apiRequest("/api/war-groups/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
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
    // Auto-update name field
    if (value) {
      form.setValue("name", `Man Up God's Way - ${value}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-charcoal to-charcoal-light pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/war-groups")}
          className="mb-6 text-gold hover:text-gold-light"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to War Groups
        </Button>

        <Card className="bg-charcoal-light border-gold/20">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-8 w-8 text-gold" />
              <CardTitle className="text-2xl text-white">Register a War Group</CardTitle>
            </div>
            <CardDescription className="text-slate-light">
              Apply to start a licensed "Man Up God's Way" discipleship group in your city.
              All registrations are reviewed by our team before approval.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => registerMutation.mutate(data))}
                className="space-y-6"
              >
                {/* Location Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gold flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Location Information
                  </h3>

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">City</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            onChange={(e) => handleCityChange(e.target.value)}
                            placeholder="e.g., Dallas"
                            className="bg-charcoal border-slate text-black"
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
                        <FormLabel className="text-white">State</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., TX"
                            className="bg-charcoal border-slate text-black"
                            data-testid="input-state"
                          />
                        </FormControl>
                        <FormDescription className="text-slate-light">
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
                        <FormLabel className="text-white">Group Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            readOnly
                            className="bg-charcoal/50 border-slate text-black cursor-not-allowed"
                            data-testid="input-name"
                          />
                        </FormControl>
                        <FormDescription className="text-slate-light">
                          Auto-generated based on city name
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Group Details Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Group Details
                  </h3>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Describe your vision for this war group..."
                            className="bg-charcoal border-slate text-black min-h-[100px]"
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
                        <FormLabel className="text-white">Proposed Meeting Information</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="When and where do you plan to meet? (e.g., Every Tuesday 7pm at Community Center)"
                            className="bg-charcoal border-slate text-black min-h-[80px]"
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
                  <h3 className="text-lg font-semibold text-gold flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Contact Information
                  </h3>

                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Contact Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="your@email.com"
                            className="bg-charcoal border-slate text-black"
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
                        <FormLabel className="text-white">Contact Phone (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="tel"
                            placeholder="(555) 123-4567"
                            className="bg-charcoal border-slate text-black"
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
                  <h3 className="text-lg font-semibold text-gold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Leadership Information
                  </h3>

                  <FormField
                    control={form.control}
                    name="leadershipExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Leadership Experience</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Share your leadership background and experience in ministry or discipleship..."
                            className="bg-charcoal border-slate text-black min-h-[100px]"
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
                        <FormLabel className="text-white">Why do you want to start this war group?</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="What's your vision and motivation for leading this group?"
                            className="bg-charcoal border-slate text-black min-h-[100px]"
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
                    className="flex-1"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={registerMutation.isPending}
                    className="flex-1 bg-gold text-charcoal hover:bg-gold-light"
                    data-testid="button-submit-registration"
                  >
                    {registerMutation.isPending ? "Submitting..." : "Submit Registration"}
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
