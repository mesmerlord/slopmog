import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import LogoBlob from "@/components/LogoBlob";
import MascotBlob from "@/components/MascotBlob";
import { trpc } from "@/utils/trpc";

interface AuthForm {
  email: string;
  name: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mode, setMode] = useState<"idle" | "login" | "signup">("idle");
  const [isLoading, setIsLoading] = useState(false);

  const callbackUrl = (router.query.callbackUrl as string) || "/dashboard";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AuthForm>({ defaultValues: { email: "", name: "", password: "" } });

  const emailValue = watch("email");

  // Redirect if already logged in
  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  // Check email on blur
  const checkEmail = trpc.user.checkEmailExists.useQuery(
    { email: emailValue },
    {
      enabled: false,
    },
  );

  const registerMutation = trpc.user.register.useMutation({
    onSuccess: async () => {
      // Auto sign in after registration
      const result = await signIn("credentials", {
        email: emailValue,
        password: watch("password"),
        redirect: false,
      });
      if (result?.ok) {
        toast.success("Welcome to SlopMog! You got 3 free credits.");
        router.push(callbackUrl);
      } else {
        toast.error("Account created but sign-in failed. Please try logging in.");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleEmailBlur = async () => {
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) return;
    const result = await checkEmail.refetch();
    if (result.data?.exists) {
      setMode("login");
    } else {
      setMode("signup");
    }
  };

  const onSubmit = async (data: AuthForm) => {
    setIsLoading(true);
    try {
      if (mode === "login") {
        const result = await signIn("credentials", {
          email: data.email,
          password: data.password,
          redirect: false,
        });
        if (result?.error) {
          toast.error("Invalid email or password");
        } else if (result?.ok) {
          toast.success("Welcome back!");
          router.push(callbackUrl);
        }
      } else if (mode === "signup") {
        await registerMutation.mutateAsync({
          name: data.name,
          email: data.email,
          password: data.password,
        });
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl });
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const error = router.query.error as string | undefined;

  return (
    <>
      <Seo title="Sign In — SlopMog" noIndex />

      <div className="min-h-screen bg-bg flex">
        {/* Left: Form */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-[400px]">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2 mb-10">
              <LogoBlob className="w-10 h-10 shrink-0" />
              <span className="font-heading font-bold text-2xl text-charcoal">SlopMog</span>
            </a>

            {/* Header copy */}
            <h1 className="font-heading font-bold text-2xl md:text-3xl text-charcoal mb-2">
              {mode === "signup" ? "Join the dark side of marketing" : "Welcome back, you beautiful shill"}
            </h1>
            <p className="text-charcoal-light text-[0.95rem] mb-8">
              {mode === "signup"
                ? "Create your account and get 3 free credits to start."
                : "Sign in to your account and keep the recommendations flowing."}
            </p>

            {/* Error from NextAuth */}
            {error && (
              <div className="bg-coral/10 text-coral text-sm font-medium px-4 py-3 rounded-brand-sm mb-6">
                {error === "OAuthAccountNotLinked"
                  ? "This email is already registered with a different sign-in method."
                  : "Something went wrong. Please try again."}
              </div>
            )}

            {/* Google OAuth */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-charcoal/[0.08] rounded-full py-3 px-6 font-bold text-[0.95rem] text-charcoal hover:border-charcoal/20 hover:-translate-y-0.5 hover:shadow-brand-sm transition-all"
              onClick={handleGoogleSignIn}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-charcoal/[0.08]" />
              <span className="text-[0.82rem] text-charcoal-light font-medium">or continue with email</span>
              <div className="flex-1 h-px bg-charcoal/[0.08]" />
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-charcoal mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-[0.95rem] text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors"
                  {...register("email", {
                    required: "Email is required",
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" },
                  })}
                  onBlur={handleEmailBlur}
                />
                {errors.email && (
                  <p className="text-coral text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Name field — signup only */}
              {mode === "signup" && (
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-charcoal mb-1.5">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    className="w-full px-4 py-3 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-[0.95rem] text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors"
                    {...register("name", { required: mode === "signup" ? "Name is required" : false })}
                  />
                  {errors.name && (
                    <p className="text-coral text-xs mt-1">{errors.name.message}</p>
                  )}
                </div>
              )}

              {/* Password field — shows after email check */}
              {mode !== "idle" && (
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-charcoal mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                    className="w-full px-4 py-3 bg-white border-2 border-charcoal/[0.08] rounded-brand-sm text-[0.95rem] text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:border-teal transition-colors"
                    {...register("password", {
                      required: "Password is required",
                      minLength: mode === "signup" ? { value: 8, message: "At least 8 characters" } : undefined,
                    })}
                  />
                  {errors.password && (
                    <p className="text-coral text-xs mt-1">{errors.password.message}</p>
                  )}
                </div>
              )}

              {mode !== "idle" && (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-coral text-white py-3 rounded-full font-bold text-[0.95rem] shadow-lg shadow-coral/25 hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-xl hover:shadow-coral/30 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {isLoading
                    ? "Hold on..."
                    : mode === "signup"
                      ? "Create Account"
                      : "Sign In"}
                </button>
              )}

              {mode === "idle" && (
                <p className="text-[0.85rem] text-charcoal-light text-center">
                  Enter your email to get started
                </p>
              )}
            </form>

            <p className="text-[0.78rem] text-charcoal-light/60 text-center mt-8">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>

        {/* Right: Illustration — hidden on mobile */}
        <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-teal-bg via-bg to-teal-light/30 relative overflow-hidden">
          {/* Decorative elements */}
          <svg className="absolute top-20 left-[10%] w-16 h-16 opacity-10 pointer-events-none" viewBox="0 0 60 60" fill="none">
            <circle cx="30" cy="30" r="28" stroke="#2EC4B6" strokeWidth="2" strokeDasharray="6 6" />
          </svg>
          <svg className="absolute bottom-32 right-[12%] w-10 h-10 opacity-10 pointer-events-none" viewBox="0 0 40 40" fill="none">
            <path d="M20 2l4 12h12l-10 7 4 12-10-7-10 7 4-12L4 14h12z" fill="#FFD93D" />
          </svg>
          <svg className="absolute top-[40%] right-[8%] w-8 h-8 opacity-10 pointer-events-none" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="4" width="24" height="24" rx="6" stroke="#B197FC" strokeWidth="2" />
          </svg>

          {/* Mascot scene */}
          <div className="relative w-[300px] h-[300px]">
            <div className="sparkle absolute top-2 left-6 text-sunny text-xl z-[1]">&#10024;</div>
            <div className="sparkle absolute bottom-8 right-6 text-sunny text-lg z-[1]" style={{ animationDelay: "1s" }}>&#10024;</div>
            <div className="sparkle absolute top-1/2 right-2 text-sunny text-2xl z-[1]" style={{ animationDelay: "2s" }}>&#11088;</div>

            <div className="mascot-chat-bubble absolute top-2 right-0 bg-white px-4 py-3 rounded-[18px_18px_18px_4px] text-[0.8rem] font-bold text-charcoal shadow-[0_4px_15px_rgba(45,48,71,0.1)] border-2 border-[rgb(245,237,224)] whitespace-nowrap z-[2]">
              &ldquo;Best tool ever!&rdquo;
            </div>
            <div
              className="mascot-chat-bubble absolute bottom-12 left-0 bg-white px-4 py-3 rounded-[18px_18px_4px_18px] text-[0.8rem] font-bold text-charcoal shadow-[0_4px_15px_rgba(45,48,71,0.1)] border-2 border-[rgb(245,237,224)] whitespace-nowrap z-[2]"
              style={{ animationDelay: "1.5s" }}
            >
              &ldquo;10/10 recommend&rdquo;
            </div>

            <MascotBlob />
          </div>

          {/* Brand tagline */}
          <p className="absolute bottom-12 text-center text-charcoal-light/60 text-sm font-medium px-8">
            The name is ridiculous. The results aren&apos;t.
          </p>
        </div>
      </div>
    </>
  );
}
