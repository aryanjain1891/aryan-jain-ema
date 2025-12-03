import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

interface InsurerLoginProps {
    onLogin: () => void;
}

export const InsurerLogin = ({ onLogin }: InsurerLoginProps) => {
    const [password, setPassword] = useState("");
    const [error, setError] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === "Ema-Insurer") {
            onLogin();
            setError(false);
        } else {
            setError(true);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                        <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Insurer Portal Access</CardTitle>
                    <CardDescription>Please enter the access code to continue</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Enter access code"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setError(false);
                                }}
                                className={error ? "border-destructive" : ""}
                            />
                            {error && (
                                <p className="text-sm text-destructive">Incorrect access code</p>
                            )}
                        </div>
                        <Button type="submit" className="w-full">
                            Access Portal
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};
