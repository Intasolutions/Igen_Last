from rest_framework.permissions import BasePermission

class IsSuperUser(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'SUPER_USER'


class IsCenterHead(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'CENTER_HEAD'


class IsAccountant(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'ACCOUNTANT'


class IsPropertyManager(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'PROPERTY_MANAGER'


class IsSuperUserOrPropertyManager(BasePermission):
    """
    Grants access if the user is either SUPER_USER or PROPERTY_MANAGER.
    """
    def has_permission(self, request, view):
        return request.user and request.user.role in ['SUPER_USER', 'PROPERTY_MANAGER']

class IsSuperUserOrCenterHead(BasePermission):
    """
    Grants access if the user is either SUPER_USER or CENTER_HEAD.
    """
    def has_permission(self, request, view):
        return request.user and request.user.role in ['SUPER_USER', 'CENTER_HEAD']
