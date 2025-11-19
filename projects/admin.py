from django.contrib import admin
from .models import Project, ProjectKeyDate, Property, ProjectMilestone


class ProjectKeyDateInline(admin.TabularInline):
    model = ProjectKeyDate
    extra = 1


class ProjectMilestoneInline(admin.TabularInline):  # NEW
    model = ProjectMilestone
    extra = 1


class PropertyInline(admin.TabularInline):
    model = Property
    extra = 1


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_date', 'end_date', 'company', 'property_manager')
    list_filter = ('company', 'property_manager', 'start_date', 'end_date', 'state', 'district')
    search_fields = ('name', 'company__name', 'district', 'city', 'pincode')
    inlines = [ProjectKeyDateInline, ProjectMilestoneInline, PropertyInline]  # include milestones


@admin.register(ProjectKeyDate)
class ProjectKeyDateAdmin(admin.ModelAdmin):
    list_display = ('label', 'project', 'due_date')
    list_filter = ('due_date',)
    search_fields = ('label', 'project__name')


@admin.register(ProjectMilestone)  # NEW
class ProjectMilestoneAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'start_date', 'end_date', 'status')
    list_filter = ('status', 'start_date', 'end_date')
    search_fields = ('name', 'project__name')


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'status', 'purchase_date', 'purchase_price')
    list_filter = ('status', 'purchase_date', 'project')
    search_fields = ('name', 'location', 'project__name')
