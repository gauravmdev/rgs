import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
    const sizes = {
        sm: 24,
        md: 40,
        lg: 64,
    };

    return (
        <div className="flex items-center justify-center">
            <Loader2 className="animate-spin text-primary-600" size={sizes[size]} />
        </div>
    );
}
