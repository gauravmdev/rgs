import React from 'react';
import ReactDatePicker from 'react-datepicker';
import { Calendar } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

interface DatePickerProps {
    selected: Date | null;
    onChange: (date: Date | null) => void;
    placeholderText?: string;
    minDate?: Date;
    maxDate?: Date;
    className?: string;
    required?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
    selected,
    onChange,
    placeholderText = 'Select date',
    minDate,
    maxDate,
    className = '',
    required = false,
}) => {
    return (
        <div className="relative">
            <ReactDatePicker
                selected={selected}
                onChange={onChange}
                dateFormat="dd/MM/yyyy"
                placeholderText={placeholderText}
                minDate={minDate}
                maxDate={maxDate}
                required={required}
                className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer ${className}`}
                showPopperArrow={false}
            />
            <Calendar
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                size={18}
            />
        </div>
    );
};

export default DatePicker;
