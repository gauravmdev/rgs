import PDFDocument from 'pdfkit';
import { Writable } from 'stream';

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

interface DeliveryData {
    deliveryBoyName: string;
    totalDeliveries: number;
    avgDeliveryTime: number;
    onTimePercentage: number;
}

export async function generateSalesPDF(
    data: SalesData[],
    filters: { startDate?: string; endDate?: string; storeName?: string }
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text('Sales Report', { align: 'center' });
        doc.moveDown();

        // Filters
        doc.fontSize(10);
        if (filters.startDate) doc.text(`Period: ${filters.startDate} to ${filters.endDate || 'Present'}`);
        if (filters.storeName) doc.text(`Store: ${filters.storeName}`);
        doc.moveDown();

        // Summary
        const totalSales = data.reduce((sum, d) => sum + d.totalSales, 0);
        const totalOrders = data.reduce((sum, d) => sum + d.totalOrders, 0);
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        doc.fontSize(12).fillColor('#333');
        doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`);
        doc.text(`Total Orders: ${totalOrders}`);
        doc.text(`Average Order Value: ₹${avgOrderValue.toFixed(2)}`);
        doc.moveDown();

        // Table Header
        doc.fontSize(10).fillColor('#000');
        const tableTop = doc.y;
        doc.text('Date', 50, tableTop);
        doc.text('Sales', 200, tableTop);
        doc.text('Orders', 300, tableTop);
        doc.text('Avg Value', 400, tableTop);
        if (data[0]?.storeName) doc.text('Store', 500, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        doc.moveDown();

        // Table Rows
        let yPosition = tableTop + 20;
        data.forEach((row) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }
            doc.text(row.date, 50, yPosition);
            doc.text(`₹${row.totalSales.toFixed(2)}`, 200, yPosition);
            doc.text(row.totalOrders.toString(), 300, yPosition);
            doc.text(`₹${row.avgOrderValue.toFixed(2)}`, 400, yPosition);
            if (row.storeName) doc.text(row.storeName, 500, yPosition);
            yPosition += 20;
        });

        // Footer
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).text(
                `Page ${i + 1} of ${pages.count}`,
                50,
                doc.page.height - 50,
                { align: 'center' }
            );
        }

        doc.end();
    });
}

export async function generateOrdersPDF(
    data: OrderData[],
    filters: { startDate?: string; endDate?: string; status?: string; storeName?: string }
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text('Orders Report', { align: 'center' });
        doc.moveDown();

        // Filters
        doc.fontSize(10);
        if (filters.startDate) doc.text(`Period: ${filters.startDate} to ${filters.endDate || 'Present'}`);
        if (filters.status) doc.text(`Status: ${filters.status}`);
        if (filters.storeName) doc.text(`Store: ${filters.storeName}`);
        doc.moveDown();

        // Summary
        doc.fontSize(12);
        doc.text(`Total Orders: ${data.length}`);
        doc.text(`Total Amount: ₹${data.reduce((sum, o) => sum + o.invoiceAmount, 0).toFixed(2)}`);
        doc.moveDown();

        // Table Header
        doc.fontSize(8).fillColor('#000');
        const tableTop = doc.y;
        doc.text('Order #', 50, tableTop, { width: 70 });
        doc.text('Customer', 120, tableTop, { width: 100 });
        doc.text('Store', 220, tableTop, { width: 80 });
        doc.text('Amount', 300, tableTop, { width: 60 });
        doc.text('Status', 360, tableTop, { width: 70 });
        // source removed
        doc.text('Date', 430, tableTop, { width: 60 });

        doc.moveTo(50, tableTop + 12).lineTo(550, tableTop + 12).stroke();

        // Table Rows
        let yPosition = tableTop + 15;
        data.forEach((order) => {
            if (yPosition > 750) {
                doc.addPage();
                yPosition = 50;
            }
            doc.fontSize(7);
            doc.text(order.orderNumber, 50, yPosition, { width: 70 });
            doc.text(order.customerName, 120, yPosition, { width: 100 });
            doc.text(order.storeName, 220, yPosition, { width: 80 });
            doc.text(`₹${order.invoiceAmount.toFixed(2)}`, 300, yPosition, { width: 60 });
            doc.text(order.status, 360, yPosition, { width: 70 });
            // source removed
            doc.text(new Date(order.createdAt).toLocaleDateString(), 430, yPosition, { width: 60 });
            yPosition += 15;
        });

        // Footer
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).text(
                `Page ${i + 1} of ${pages.count}`,
                50,
                doc.page.height - 50,
                { align: 'center' }
            );
        }

        doc.end();
    });
}

export async function generateCustomersPDF(
    data: CustomerData[],
    filters: { storeName?: string }
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text('Customer Report', { align: 'center' });
        doc.moveDown();

        // Filters
        if (filters.storeName) {
            doc.fontSize(10).text(`Store: ${filters.storeName}`);
            doc.moveDown();
        }

        // Summary
        doc.fontSize(12);
        doc.text(`Total Customers: ${data.length}`);
        doc.text(`Total Sales: ₹${data.reduce((sum, c) => sum + c.totalSales, 0).toFixed(2)}`);
        doc.text(`Total Outstanding Dues: ₹${data.reduce((sum, c) => sum + c.totalDues, 0).toFixed(2)}`);
        doc.moveDown();

        // Table Header
        doc.fontSize(8).fillColor('#000');
        const tableTop = doc.y;
        doc.text('Name', 50, tableTop, { width: 120 });
        doc.text('Phone', 170, tableTop, { width: 80 });
        doc.text('Store', 250, tableTop, { width: 100 });
        doc.text('Orders', 350, tableTop, { width: 50 });
        doc.text('Sales', 400, tableTop, { width: 70 });
        doc.text('Dues', 470, tableTop, { width: 70 });

        doc.moveTo(50, tableTop + 12).lineTo(550, tableTop + 12).stroke();

        // Table Rows
        let yPosition = tableTop + 15;
        data.forEach((customer) => {
            if (yPosition > 750) {
                doc.addPage();
                yPosition = 50;
            }
            doc.fontSize(7);
            doc.text(customer.name, 50, yPosition, { width: 120 });
            doc.text(customer.phone, 170, yPosition, { width: 80 });
            doc.text(customer.storeName, 250, yPosition, { width: 100 });
            doc.text(customer.totalOrders.toString(), 350, yPosition, { width: 50 });
            doc.text(`₹${customer.totalSales.toFixed(2)}`, 400, yPosition, { width: 70 });
            doc.text(`₹${customer.totalDues.toFixed(2)}`, 470, yPosition, { width: 70 });
            yPosition += 15;
        });

        // Footer
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).text(
                `Page ${i + 1} of ${pages.count}`,
                50,
                doc.page.height - 50,
                { align: 'center' }
            );
        }

        doc.end();
    });
}

export async function generateDeliveryPerformancePDF(
    data: DeliveryData[],
    filters: { startDate?: string; endDate?: string }
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text('Delivery Performance Report', { align: 'center' });
        doc.moveDown();

        // Filters
        if (filters.startDate) {
            doc.fontSize(10).text(`Period: ${filters.startDate} to ${filters.endDate || 'Present'}`);
            doc.moveDown();
        }

        // Summary
        const totalDeliveries = data.reduce((sum, d) => sum + d.totalDeliveries, 0);
        const avgTime = data.reduce((sum, d) => sum + d.avgDeliveryTime, 0) / data.length;
        const avgOnTime = data.reduce((sum, d) => sum + d.onTimePercentage, 0) / data.length;

        doc.fontSize(12);
        doc.text(`Total Deliveries: ${totalDeliveries}`);
        doc.text(`Average Delivery Time: ${avgTime.toFixed(1)} minutes`);
        doc.text(`Average On-Time %: ${avgOnTime.toFixed(1)}%`);
        doc.moveDown();

        // Table Header
        doc.fontSize(9).fillColor('#000');
        const tableTop = doc.y;
        doc.text('Delivery Boy', 50, tableTop, { width: 150 });
        doc.text('Total Deliveries', 200, tableTop, { width: 100 });
        doc.text('Avg Time (min)', 300, tableTop, { width: 100 });
        doc.text('On-Time %', 400, tableTop, { width: 100 });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Table Rows
        let yPosition = tableTop + 20;
        data.forEach((delivery) => {
            if (yPosition > 750) {
                doc.addPage();
                yPosition = 50;
            }
            doc.fontSize(8);
            doc.text(delivery.deliveryBoyName, 50, yPosition, { width: 150 });
            doc.text(delivery.totalDeliveries.toString(), 200, yPosition, { width: 100 });
            doc.text(delivery.avgDeliveryTime.toFixed(1), 300, yPosition, { width: 100 });
            doc.text(`${delivery.onTimePercentage.toFixed(1)}%`, 400, yPosition, { width: 100 });
            yPosition += 18;
        });

        // Footer
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).text(
                `Page ${i + 1} of ${pages.count}`,
                50,
                doc.page.height - 50,
                { align: 'center' }
            );
        }

        doc.end();
    });
}
