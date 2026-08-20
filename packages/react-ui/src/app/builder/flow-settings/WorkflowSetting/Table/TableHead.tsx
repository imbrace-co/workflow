
import {
  Table,
  TableHead as TableHeadComponent,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import styles from './index.module.scss';

interface HeadCell {
    id: 'name' | 'type' | 'required' | 'operation';
    label: string;
}

const EnhancedTableHead = () => {
    const headCells: HeadCell[] = [
        {
            id: 'name',
            label: 'Key',
        },
        {
            id: 'type',
            label: 'Type',
        },
        {
            id: 'required',
            label: 'Required',
        },
        { id: 'operation', label: '' },
    ];

    return (
        <Table>
            <TableHeader>
                <TableRow className={`${styles.tableRow} ${styles.tableHeader}`}>
                    {headCells.map((headCell) => (
                        <TableHeadComponent key={headCell.id} className={styles.cell}>
                            {headCell.label}
                        </TableHeadComponent>
                    ))}
                </TableRow>
            </TableHeader>
        </Table>
    );
};

export default EnhancedTableHead;
