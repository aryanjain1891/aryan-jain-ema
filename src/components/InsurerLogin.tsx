import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InsurerLoginProps {
    onLogin: () => void;
}

export const InsurerLogin = ({ onLogin }: InsurerLoginProps) => {
    const [password, setPassword] = useState("");
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === "Ema-Insurer") {
            onLogin();
            toast({
                title: "Login Successful",
                description: "Welcome to the Insurer Dashboard",
            });
        } else {
            toast({
                title: "Access Denied",
                description: "Incorrect password",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                        <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Insurer Portal Access</CardTitle>
                    <CardDescription>Please enter your credentials to continue</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <Button type="submit" className="w-full">
                            Login
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};
