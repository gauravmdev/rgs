import ExcelJS from 'exceljs';

interface SalesData {
    date: string;
    totalSales: number;
    totalOrders: number;
    avgOrderValue: number;
    storeName?: string;
}

interface OrderData {
    orderNumber: string;
    customerName: string;
    storeName: string;
    invoiceAmount: number;
    status: string;
    // source removed
    createdAt: string;
}

interface CustomerData {
    name: string;
    email: string;
    phone: string;
    storeName: string;
    totalOrders: number;
    totalSales: number;
    totalDues: number;
}

interface PaymentData {
    customerName: string;
    totalDues: number;
    lastPaymentDate?: string;
    lastPaymentAmount?: number;
    storeName: string;
}

export async function generateSalesExcel(
    data: SalesData[],
    filters: { startDate?: string; endDate?: string; storeName?: string }
): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Title
    worksheet.mergeCells('A1:E1');
    worksheet.getCell('A1').value = 'Sales Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Filters
    let row = 3;
    if (filters.startDate) {
        worksheet.getCell(`A${row}`).value = `Period: ${filters.startDate} to ${filters.endDate || 'Present'}`;
        row++;
    }
    if (filters.storeName) {
        worksheet.getCell(`A${row}`).value = `Store: ${filters.storeName}`;
        row++;
    }

    // Summary
    row++;
    const totalSales = data.reduce((sum, d) => sum + d.totalSales, 0);
    const totalOrders = data.reduce((sum, d) => sum + d.totalOrders, 0);
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    worksheet.getCell(`A${row}`).value = 'Total Sales:';
    worksheet.getCell(`B${row}`).value = totalSales;
    worksheet.getCell(`B${row}`).numFmt = '₹#,##0.00';
    row++;
    worksheet.getCell(`A${row}`).value = 'Total Orders:';
    worksheet.getCell(`B${row}`).value = totalOrders;
    row++;
    worksheet.getCell(`A${row}`).value = 'Average Order Value:';
    worksheet.getCell(`B${row}`).value = avgOrderValue;
    worksheet.getCell(`B${row}`).numFmt = '₹#,##0.00';

    // Table Header
    row += 2;
    const headerRow = worksheet.getRow(row);
    const headers = ['Date', 'Total Sales', 'Orders', 'Avg Order Value'];
    if (data[0]?.storeName) headers.push('Store');

    headerRow.values = headers;
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    // Table Data
    data.forEach((item) => {
        row++;
        const rowData: any[] = [
            item.date,
            item.totalSales,
            item.totalOrders,
            item.avgOrderValue
        ];
        if (item.storeName) rowData.push(item.storeName);

        const dataRow = worksheet.getRow(row);
        dataRow.values = rowData;
        dataRow.getCell(2).numFmt = '₹#,##0.00';
        dataRow.getCell(4).numFmt = '₹#,##0.00';
    });

    // Column widths
    worksheet.columns = [
        { width: 15 },
        { width: 15 },
        { width: 12 },
        { width: 18 },
        { width: 20 }
    ];

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

export async function generateOrdersExcel(
    data: OrderData[],
    filters: { startDate?: string; endDate?: string; status?: string; storeName?: string }
): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Orders Report');

    // Title
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = 'Orders Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Filters
    let row = 3;
    if (filters.startDate) {
        worksheet.getCell(`A${row}`).value = `Period: ${filters.startDate} to ${filters.endDate || 'Present'}`;
        row++;
    }
    if (filters.status) {
        worksheet.getCell(`A${row}`).value = `Status: ${filters.status}`;
        row++;
    }
    if (filters.storeName) {
        worksheet.getCell(`A${row}`).value = `Store: ${filters.storeName}`;
        row++;
    }

    // Summary
    row++;
    worksheet.getCell(`A${row}`).value = 'Total Orders:';
    worksheet.getCell(`B${row}`).value = data.length;
    row++;
    worksheet.getCell(`A${row}`).value = 'Total Amount:';
    worksheet.getCell(`B${row}`).value = data.reduce((sum, o) => sum + o.invoiceAmount, 0);
    worksheet.getCell(`B${row}`).numFmt = '₹#,##0.00';

    // Table Header
    row += 2;
    const headerRow = worksheet.getRow(row);
    headerRow.values = ['Order #', 'Customer', 'Store', 'Amount', 'Status', 'Date'];
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    // Table Data
    data.forEach((order) => {
        row++;
        const dataRow = worksheet.getRow(row);
        dataRow.values = [
            order.orderNumber,
            order.customerName,
            order.storeName,
            order.invoiceAmount,
            order.invoiceAmount,
            order.status,
            // source removed
            new Date(order.createdAt).toLocaleDateString()
        ];
        dataRow.getCell(4).numFmt = '₹#,##0.00';
    });

    // Column widths
    worksheet.columns = [
        { width: 15 },
        { width: 20 },
        { width: 20 },
        { width: 15 },
        { width: 20 },
        { width: 15 },
        { width: 15 }
    ];

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

export async function generateCustomersExcel(
    data: CustomerData[],
    filters: { storeName?: string }
): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customer Report');

    // Title
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = 'Customer Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Filters
    let row = 3;
    if (filters.storeName) {
        worksheet.getCell(`A${row}`).value = `Store: ${filters.storeName}`;
        row++;
    }

    // Summary
    row++;
    worksheet.getCell(`A${row}`).value = 'Total Customers:';
    worksheet.getCell(`B${row}`).value = data.length;
    row++;
    worksheet.getCell(`A${row}`).value = 'Total Sales:';
    worksheet.getCell(`B${row}`).value = data.reduce((sum, c) => sum + c.totalSales, 0);
    worksheet.getCell(`B${row}`).numFmt = '₹#,##0.00';
    row++;
    worksheet.getCell(`A${row}`).value = 'Total Outstanding Dues:';
    worksheet.getCell(`B${row}`).value = data.reduce((sum, c) => sum + c.totalDues, 0);
    worksheet.getCell(`B${row}`).numFmt = '₹#,##0.00';

    // Table Header
    row += 2;
    const headerRow = worksheet.getRow(row);
    headerRow.values = ['Name', 'Email', 'Phone', 'Store', 'Total Orders', 'Total Sales', 'Outstanding Dues'];
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    // Table Data
    data.forEach((customer) => {
        row++;
        const dataRow = worksheet.getRow(row);
        dataRow.values = [
            customer.name,
            customer.email,
            customer.phone,
            customer.storeName,
            customer.totalOrders,
            customer.totalSales,
            customer.totalDues
        ];
        dataRow.getCell(6).numFmt = '₹#,##0.00';
        dataRow.getCell(7).numFmt = '₹#,##0.00';
    });

    // Column widths
    worksheet.columns = [
        { width: 20 },
        { width: 25 },
        { width: 15 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 18 }
    ];

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

export async function generatePaymentsExcel(
    data: PaymentData[],
    filters: { storeName?: string }
): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Payment & Dues Report');

    // Title
    worksheet.mergeCells('A1:E1');
    worksheet.getCell('A1').value = 'Payment & Dues Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Filters
    let row = 3;
    if (filters.storeName) {
        worksheet.getCell(`A${row}`).value = `Store: ${filters.storeName}`;
        row++;
    }

    // Summary
    row++;
    const totalDues = data.reduce((sum, p) => sum + p.totalDues, 0);
    worksheet.getCell(`A${row}`).value = 'Total Outstanding Dues:';
    worksheet.getCell(`B${row}`).value = totalDues;
    worksheet.getCell(`B${row}`).numFmt = '₹#,##0.00';

    // Table Header
    row += 2;
    const headerRow = worksheet.getRow(row);
    headerRow.values = ['Customer', 'Store', 'Total Dues', 'Last Payment Date', 'Last Payment Amount'];
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    // Table Data
    data.forEach((payment) => {
        row++;
        const dataRow = worksheet.getRow(row);
        dataRow.values = [
            payment.customerName,
            payment.storeName,
            payment.totalDues,
            payment.lastPaymentDate || 'N/A',
            payment.lastPaymentAmount || 0
        ];
        dataRow.getCell(3).numFmt = '₹#,##0.00';
        dataRow.getCell(5).numFmt = '₹#,##0.00';
    });

    // Column widths
    worksheet.columns = [
        { width: 25 },
        { width: 20 },
        { width: 15 },
        { width: 18 },
        { width: 20 }
    ];

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}
