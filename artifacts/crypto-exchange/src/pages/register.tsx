import { apiErrorMessage } from "@/lib/api-error";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { PublicLayout } from "@/components/layout";
import { Button, Input, Card } from "@/components/ui/shared";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria",
  "Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia",
  "Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica",
  "Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt",
  "El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon",
  "Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti",
  "Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan",
  "Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia",
  "Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta",
  "Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro",
  "Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger",
  "Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea",
  "Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis",
  "Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia",
  "Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia",
  "South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria",
  "Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey",
  "Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay",
  "Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe",
];

const registerSchema = z.object({
  name: z.string().min(2, "Full name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Valid phone number required").regex(/^\+?[0-9\s\-().]+$/, "Invalid phone format"),
  country: z.string().min(1, "Country required"),
  dateOfBirth: z.string().min(1, "Date of birth required").refine((val) => {
    const dob = new Date(val);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    return age >= 18;
  }, "You must be at least 18 years old"),
  password: z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

const STEPS = ["Personal Info", "Location", "Security"];

export default function RegisterPage() {
  const { register: registerUser, isRegisterPending } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const { register, handleSubmit, trigger, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
  });

  const stepFields: (keyof RegisterForm)[][] = [
    ["name", "email"],
    ["phone", "country", "dateOfBirth"],
    ["password", "confirmPassword"],
  ];

  const nextStep = async () => {
    const valid = await trigger(stepFields[step]);
    if (valid) setStep((s) => s + 1);
  };

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError(null);
      const { confirmPassword, ...payload } = data;
      await registerUser(payload);
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to register. Please try again."));
    }
  };

  return (
    <PublicLayout>
      <div className="flex-1 flex items-center justify-center p-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <Card className="p-8 backdrop-blur-xl bg-card/90">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-display font-bold text-foreground">Create Account</h1>
              <p className="text-muted-foreground mt-2">Start your crypto journey today</p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-8">
              {STEPS.map((label, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className={cn(
                    "h-1.5 w-full rounded-full transition-all duration-300",
                    i <= step ? "bg-primary" : "bg-border"
                  )} />
                  <span className={cn(
                    "text-[10px] font-medium transition-colors",
                    i === step ? "text-primary" : "text-muted-foreground"
                  )}>{label}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Step 0 — Personal Info */}
              {step === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground ml-1">Full Legal Name</label>
                    <Input {...register("name")} placeholder="John Doe" />
                    {errors.name && <p className="text-destructive text-sm ml-1">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground ml-1">Email Address</label>
                    <Input {...register("email")} type="email" placeholder="john@example.com" />
                    {errors.email && <p className="text-destructive text-sm ml-1">{errors.email.message}</p>}
                  </div>
                </motion.div>
              )}

              {/* Step 1 — Location & Identity */}
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground ml-1">Phone Number</label>
                    <Input {...register("phone")} type="tel" placeholder="+1 555 000 0000" />
                    {errors.phone && <p className="text-destructive text-sm ml-1">{errors.phone.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground ml-1">Country of Residence</label>
                    <div className="relative">
                      <select
                        {...register("country")}
                        className="w-full appearance-none px-4 py-3 pr-10 rounded-xl bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm transition-all"
                      >
                        <option value="">Select your country</option>
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                    {errors.country && <p className="text-destructive text-sm ml-1">{errors.country.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground ml-1">Date of Birth</label>
                    <Input {...register("dateOfBirth")} type="date" max={new Date(new Date().setFullYear(new Date().getFullYear()-18)).toISOString().split("T")[0]} />
                    {errors.dateOfBirth && <p className="text-destructive text-sm ml-1">{errors.dateOfBirth.message}</p>}
                    <p className="text-xs text-muted-foreground ml-1">You must be at least 18 years old to register.</p>
                  </div>
                </motion.div>
              )}

              {/* Step 2 — Security */}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground ml-1">Password</label>
                    <Input {...register("password")} type="password" placeholder="At least 8 characters" />
                    {errors.password && <p className="text-destructive text-sm ml-1">{errors.password.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground ml-1">Confirm Password</label>
                    <Input {...register("confirmPassword")} type="password" placeholder="Repeat your password" />
                    {errors.confirmPassword && <p className="text-destructive text-sm ml-1">{errors.confirmPassword.message}</p>}
                  </div>
                </motion.div>
              )}

              {/* Navigation */}
              <div className={cn("flex gap-3 mt-8", step > 0 ? "justify-between" : "justify-end")}>
                {step > 0 && (
                  <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                    Back
                  </Button>
                )}
                {step < STEPS.length - 1 ? (
                  <Button type="button" onClick={nextStep}>
                    Continue
                  </Button>
                ) : (
                  <Button type="submit" disabled={isRegisterPending} className="px-8">
                    {isRegisterPending ? "Creating Account..." : "Create Account"}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Log In
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </PublicLayout>
  );
}
