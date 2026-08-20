import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Edit } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import styles from './index.module.scss';
import { ParameterPropertyFormData } from './index';
import ParameterPropertyArraySettingForm from './parameterPropertyArraySettingForm';

interface ParameterPropertyFormProps {
  editingItem?: ParameterPropertyFormData | null;
  onConfirm: (data: ParameterPropertyFormData) => void;
  onCancel: () => void;
  parameterProperties: Record<string, any>;
  t: (key: string) => string;
}

const ParameterPropertyForm = ({ 
  editingItem, 
  onConfirm, 
  onCancel, 
  parameterProperties, 
  t 
}: ParameterPropertyFormProps) => {
    const [arrayDialogOpen, setArrayDialogOpen] = useState(false);
    const [editingArrayItem, setEditingArrayItem] = useState<any>(null);

    // Form methods for array settings dialog
    const arraySettingsMethods = useForm<{ type: string; description: string }>({
        defaultValues: {
            type: 'string',
            description: '',
        },
    });

    // Main form for the property
    const form = useForm<ParameterPropertyFormData>({
        defaultValues: {
            name: editingItem?.name || '',
            type: editingItem?.type || 'string',
            description: editingItem?.description || '',
            required: editingItem?.required || false,
            items: editingItem?.items,
            enum: Array.isArray(editingItem?.enum) ? editingItem.enum.join(',') : editingItem?.enum || '',
        },
    });

    const { control, watch, setValue, getValues } = form;
    const formValues = watch();

    const openArraySettingDialog = (item?: any) => {
        setEditingArrayItem(item || null);
        if (item) {
            arraySettingsMethods.reset({
                type: item?.type || 'string',
                description: item?.description || '',
            });
        } else {
            arraySettingsMethods.reset({
                type: 'string',
                description: '',
            });
        }
        setArrayDialogOpen(true);
    };

    const handleArrayDialogConfirm = async () => {
        const isValid = await arraySettingsMethods.trigger();
        if (!isValid) return false;

        const formData = arraySettingsMethods.getValues();
        const { type, description } = formData;
        
        setValue(
            'items',
            {
                type,
                description: description || '',
            },
            { shouldDirty: true },
        );
        setValue('type', 'array', { shouldDirty: true });
        setArrayDialogOpen(false);
        return true;
    };

    const handleSubmit = (data: ParameterPropertyFormData) => {
        onConfirm(data);
    };

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field, fieldState: { error } }) => (
                            <FormItem>
                                <FormLabel>{t('Key')}*</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        placeholder={t('Key')}
                                        className={error ? 'border-destructive' : ''}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                
                    <FormField
                        control={form.control}
                        name="type"
                        render={({ field, fieldState: { error } }) => (
                            <FormItem>
                                <FormLabel>{t('Type')}*</FormLabel>
                                <div className="flex items-end gap-2">
                                    <Select
                                        value={field.value}
                                        onValueChange={(value) => {
                                            if (value === 'array') {
                                                openArraySettingDialog();
                                                return;
                                            }
                                            field.onChange(value);
                                        }}
                                    >
                                        <FormControl>
                                            <SelectTrigger className={error ? 'border-destructive' : ''}>
                                                <SelectValue placeholder={t('Select type')} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="string">{t('String')}</SelectItem>
                                            <SelectItem value="number">{t('Number')}</SelectItem>
                                            <SelectItem value="array">{t('Array')}</SelectItem>
                                            <SelectItem value="boolean">{t('Boolean')}</SelectItem>
                                            <SelectItem value="object">{t('Object')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    
                                    {formValues.items && formValues.type === 'array' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openArraySettingDialog(formValues.items);
                                            }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field, fieldState: { error } }) => (
                            <FormItem>
                                <FormLabel>{t('Description')}</FormLabel>
                                <FormControl>
                                    <Textarea
                                        {...field}
                                        placeholder={t('Description')}
                                        className={error ? 'border-destructive' : ''}
                                        rows={3}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                
                    <FormField
                        control={form.control}
                        name="enum"
                        render={({ field, fieldState: { error } }) => (
                            <FormItem>
                                <FormLabel>{t('Enum')}</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        placeholder={t('Comma-separated values')}
                                        className={error ? 'border-destructive' : ''}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                
                    <FormField
                        control={form.control}
                        name="required"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                    <Switch
                                        checked={field.value || false}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">{t('Required')}</FormLabel>
                            </FormItem>
                        )}
                    />
                    
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onCancel}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit">
                            {editingItem ? t('Update') : t('Create')}
                        </Button>
                    </div>
                </form>
            </Form>

            {/* Array Settings Dialog */}
            <Dialog open={arrayDialogOpen} onOpenChange={setArrayDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingArrayItem ? t('Edit Array Setting') : t('Add Array Setting')}
                        </DialogTitle>
                    </DialogHeader>
                    <ParameterPropertyArraySettingForm 
                        methods={arraySettingsMethods} 
                        onConfirm={() => handleArrayDialogConfirm()}
                        onCancel={() => setArrayDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ParameterPropertyForm;
