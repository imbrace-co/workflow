import { useRef } from 'react';
import { Info, Edit, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableRow as TableRowComponent,
} from '@/components/ui/table';

import styles from './index.module.scss';
import { ParameterProperty } from '../index';

const TableRow = ({
    item,
    onCheck,
    openDialog,
    handleDeleteField,
}: {
    item: ParameterProperty;
    onCheck: (val: boolean) => void;
    openDialog: (item?: ParameterProperty) => void;
    handleDeleteField: (item: ParameterProperty) => void;
}) => {
    const containerRef = useRef<HTMLTableRowElement>(null);
    if (!item) {
        return <></>;
    }
    return (
        <>
            <TableRowComponent className={styles.tableRow} ref={containerRef}>
                <TableCell className={`${styles.cell} flex items-center gap-1 pl-3`}>
                    {item.name}
                    {item.description && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{item.description}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </TableCell>
                <TableCell className={`${styles.cell} flex items-center gap-1.5`}>
                    {item.type}
                </TableCell>
                <TableCell className={`${styles.cell} flex items-center gap-1.5`}>
                    <div className="flex items-center gap-1">
                        <Checkbox
                            disabled
                            checked={item.required || false}
                            onCheckedChange={()=>{}}
                        />
                    </div>
                </TableCell>
                <TableCell className={`${styles.cell} ${styles.operation} flex items-center gap-1.5`}>
                    <div className="flex items-center gap-1.5 ml-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                openDialog(item);
                            }}
                            className="h-8 w-8 p-0"
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteField(item);
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </TableCell>
            </TableRowComponent>
        </>
    );
};

export default TableRow;
