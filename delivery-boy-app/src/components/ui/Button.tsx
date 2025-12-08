import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: 'primary' | 'secondary' | 'success' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    fullWidth?: boolean;
}

export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    disabled,
    className = '',
    ...props
}: ButtonProps) {
    const baseStyles = 'font-medium rounded-lg transition-all active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-md',
        secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
        success: 'bg-green-600 hover:bg-green-700 text-white shadow-md',
        danger: 'bg-red-600 hover:bg-red-700 text-white shadow-md',
    };

    const sizes = {
        sm: 'py-2 px-4 text-sm',
        md: 'py-3 px-6 text-base',
        lg: 'py-4 px-8 text-lg',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading && <Loader2 className="animate-spin mr-2" size={20} />}
            {children}
        </button>
    );
}
