import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Shield, MapPin, Users, Mail, FileText, BookOpen, CheckCircle, Headphones, Award, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

        <Tabs defaultValue="about" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-charcoal-light border border-gold/20 mb-6">
            <TabsTrigger 
              value="about" 
              className="data-[state=active]:bg-gold data-[state=active]:text-charcoal text-white"
              data-testid="tab-about"
            >
              What are War Groups?
            </TabsTrigger>
            <TabsTrigger 
              value="register" 
              className="data-[state=active]:bg-gold data-[state=active]:text-charcoal text-white"
              data-testid="tab-register"
            >
              Register
            </TabsTrigger>
          </TabsList>

          {/* About War Groups Tab */}
          <TabsContent value="about" className="space-y-6">
            <Card className="bg-charcoal-light border-gold/20">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="h-8 w-8 text-gold" />
                  <CardTitle className="text-2xl text-white">Welcome to War Groups</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 text-slate-light">
                <p className="text-white leading-relaxed">
                  War Groups are small, brotherhood-driven discipleship groups designed to help men grow strong in their faith, sharpen their character, and live out biblical manhood in everyday life. This is not a casual gathering or a surface-level Bible study. War Groups are about commitment, accountability, and real spiritual transformation through the Word of God.
                </p>
                <p className="leading-relaxed">
                  In a War Group, men meet regularly with a clear purpose: to pursue Christ together, speak truth in love, and walk shoulder to shoulder through life's battles. You will be challenged to grow spiritually, lead your home with integrity, and stand firm in a culture that constantly pulls men away from God's design.
                </p>

                <div className="border-t border-gold/20 pt-6">
                  <h3 className="text-xl font-bold text-gold mb-4">Benefits of Starting or Joining a War Group</h3>
                  <p className="mb-4">When you join or launch a War Group, you gain access to a complete discipleship ecosystem built to equip and sustain men for the long haul.</p>
                  
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <BookOpen className="h-6 w-6 text-gold flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-white font-semibold mb-1">Unlimited Bible Studies</h4>
                        <p className="text-sm">You will have unlimited access to biblically grounded Bible studies that walk men through foundational faith, spiritual discipline, leadership, and perseverance. These studies are designed to be practical, Scripture-centered, and easy to lead, whether you are a seasoned leader or stepping into leadership for the first time.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Award className="h-6 w-6 text-gold flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-white font-semibold mb-1">Leadership Training</h4>
                        <p className="text-sm">You will receive ongoing leadership training to help you grow as a man, husband, father, and disciple-maker. This includes guidance on leading groups, discipling others, and building strong, accountable brotherhoods.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Headphones className="h-6 w-6 text-gold flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-white font-semibold mb-1">Monthly Prayer Calls</h4>
                        <p className="text-sm">War Group members are invited to monthly prayer calls that unite men across the country. These calls focus on prayer, encouragement, biblical teaching, and standing together in spiritual warfare.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <CheckCircle className="h-6 w-6 text-gold flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-white font-semibold mb-1">Official Recognition</h4>
                        <p className="text-sm">As a licensed War Group, you are officially recognized as part of the War Groups network. Your group can be listed and pinned on the app, helping men in your area find biblical brotherhood and accountability.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <ShoppingBag className="h-6 w-6 text-gold flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-white font-semibold mb-1">Licensed Merchandise</h4>
                        <p className="text-sm">You also gain access to licensed War Groups merchandise, including apparel and materials that represent commitment, identity, and mission. These resources help build unity within your group and visibility in your community.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gold/20 pt-6">
                  <p className="text-white leading-relaxed">
                    War Groups provide structure without control, accountability without shame, and brotherhood without isolation. This is not about hype or personality. It is about men standing together under the authority of God's Word.
                  </p>
                  <p className="text-gold font-semibold mt-4">
                    If you are ready to stop walking alone and start building something that lasts, War Groups are where the fight becomes family.
                  </p>
                </div>

                <div className="border-t border-gold/20 pt-6">
                  <h3 className="text-xl font-bold text-gold mb-4">War Groups HQ</h3>
                  <p className="leading-relaxed mb-4">
                    War Groups HQ is the central hub for the War Groups movement, equipping men to live out biblical manhood through discipleship, accountability, and brotherhood. Our mission is simple and uncompromising: to raise up men who are grounded in the Word of God, committed to prayer, and willing to lead with courage in their homes, churches, and communities.
                  </p>
                  <p className="leading-relaxed mb-4">
                    War Groups HQ provides the structure, resources, and support needed to start and sustain strong discipleship groups. Through biblically sound studies, leadership training, and ongoing prayer support, we help men move from passive faith to active obedience. Everything we do is rooted in Scripture and designed for real life, real struggles, and real growth.
                  </p>
                  <p className="leading-relaxed mb-4">
                    As the headquarters for the War Groups network, we connect leaders and groups across the country, offering guidance, encouragement, and shared vision. From monthly prayer calls to leadership development and licensed resources, War Groups HQ exists to ensure no man fights alone.
                  </p>
                  <p className="text-white font-medium">
                    We believe men are called to stand firm, to sharpen one another, and to lead with integrity. War Groups HQ is where the mission is fueled, the leaders are equipped, and the brotherhood is strengthened.
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={() => (document.querySelector('[data-testid="tab-register"]') as HTMLElement)?.click()}
                    className="w-full bg-gold text-charcoal hover:bg-gold-light font-semibold py-6"
                    data-testid="button-go-to-register"
                  >
                    Ready to Start a War Group? Register Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Register Tab */}
          <TabsContent value="register">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
