import { prisma } from '../app/lib/db';

async function checkNextApprover() {
  try {
    const timesheetId = '331b5794-82d1-4951-8984-bb8c3dc7ef01';
    
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      select: { 
        id: true,
        status: true,
        workflow_instance_id: true,
      },
    });

    if (!timesheet || !timesheet.workflow_instance_id) {
      console.log('No workflow instance found');
      return;
    }

    const workflowInstance = await prisma.workflowInstance.findUnique({
      where: { id: timesheet.workflow_instance_id },
      include: {
        template: {
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
          },
        },
        steps: {
          orderBy: { step_order: 'asc' },
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!workflowInstance) {
      console.log('Workflow instance not found');
      return;
    }

    console.log('\n=== Timesheet Status ===');
    console.log(`Status: ${timesheet.status}`);
    console.log(`Workflow Status: ${workflowInstance.status}`);
    console.log(`Current Step Order: ${workflowInstance.current_step_order}`);

    console.log('\n=== Workflow Steps ===');
    workflowInstance.template.steps.forEach((step) => {
      const stepInstance = workflowInstance.steps.find(s => s.step_order === step.step_order);
      const isCurrent = step.step_order === workflowInstance.current_step_order;
      console.log(`\nStep ${step.step_order}: ${step.required_permission}`);
      console.log(`  Status: ${stepInstance?.status || 'pending'}`);
      console.log(`  Actor: ${stepInstance?.actor?.name || 'N/A'} (${stepInstance?.actor?.email || 'N/A'})`);
      console.log(`  Current: ${isCurrent ? 'YES' : 'NO'}`);
    });

    // Find next step
    const nextStep = workflowInstance.template.steps.find(
      s => s.step_order > workflowInstance.current_step_order
    );

    if (nextStep) {
      console.log('\n=== Next Step ===');
      console.log(`Step Order: ${nextStep.step_order}`);
      console.log(`Required Permission: ${nextStep.required_permission}`);
      
      // Import resolveApprovers
      const { resolveApprovers } = await import('../app/lib/services/workflow');
      
      const approvers = await resolveApprovers(
        nextStep.step_order,
        workflowInstance.id,
        workflowInstance.template.location_id || '',
        { stepConfig: nextStep }
      );

      console.log(`\nNext Approvers (${approvers.length}):`);
      for (const approverId of approvers) {
        const approver = await prisma.user.findUnique({
          where: { id: approverId },
          select: { id: true, name: true, email: true },
        });
        console.log(`  - ${approver?.name || approverId} (${approver?.email || 'N/A'})`);
      }
    } else {
      console.log('\n=== No Next Step ===');
      console.log('Workflow is complete or at final step');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNextApprover();
